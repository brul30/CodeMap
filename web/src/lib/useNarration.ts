"use client";
/* ============================================================
   useNarration — the "tour guide" voice.

   Playback tiers per node:
     1. pre-rendered Gemini TTS file (public/narration/<id>.wav), PRELOADED so
        clicks fire instantly;
     2. live Gemini TTS via /api/tts (for repos with no pre-rendered file);
     3. browser Web Speech (last-ditch fallback).

   Barge-in: every narrate() bumps a token and aborts any in-flight request, so
   rapid clicks never stack — only the latest one speaks.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";

const RATE = 1.15; // snappier, more "real-time" delivery

export function useNarration(preloadIds?: string[]) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const tokenRef = useRef(0); // bumped on every narrate → invalidates older async paths
  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // pick a browser voice (only used for the last-ditch fallback)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => /Google US English|Samantha|Microsoft Aria|Microsoft Jenny/i.test(v.name)) ||
        voices.find((v) => v.lang?.startsWith("en")) ||
        voices[0] ||
        null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  // Preload the current graph's node audio so the first click is instant.
  const preloadKey = preloadIds?.join(",");
  useEffect(() => {
    if (!preloadIds || typeof window === "undefined") return;
    for (const id of preloadIds) {
      const url = `/narration/${encodeURIComponent(id)}.wav`;
      if (!cacheRef.current.has(url)) {
        const a = new Audio();
        a.preload = "auto";
        a.src = url;
        a.playbackRate = RATE;
        cacheRef.current.set(url, a);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadKey]);

  const hardStop = useCallback(() => {
    tokenRef.current += 1; // invalidate anything in flight
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => hardStop(), [hardStop]);

  // browser Web Speech — last-ditch fallback only
  const speakText = useCallback((text: string, token?: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
    if (token !== undefined && token !== tokenRef.current) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = RATE;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  // tier 2: live Gemini TTS (abortable, token-guarded)
  const ttsLive = useCallback(
    async (text: string, token: number) => {
      if (!text) return;
      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        if (token === tokenRef.current) setSpeaking(true);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });
        if (token !== tokenRef.current) return; // superseded by a newer click
        if (!res.ok) throw new Error("tts http");
        const blob = await res.blob();
        if (token !== tokenRef.current) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const a = new Audio(url);
        a.playbackRate = RATE;
        audioRef.current = a;
        a.onended = () => {
          if (token === tokenRef.current) setSpeaking(false);
          URL.revokeObjectURL(url);
          if (blobUrlRef.current === url) blobUrlRef.current = null;
        };
        a.onerror = () => speakText(text, token);
        await a.play();
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        speakText(text, token);
      }
    },
    [speakText],
  );

  // tier 1: pre-rendered static file (preloaded) → falls through to live TTS
  const narrate = useCallback(
    (nodeId: string, fallbackText = "") => {
      hardStop(); // cancels current audio + in-flight fetch, bumps token
      const token = tokenRef.current;
      const url = `/narration/${encodeURIComponent(nodeId)}.wav`;
      const cached = cacheRef.current.get(url);
      const a = cached ?? new Audio(url);
      a.playbackRate = RATE;
      if (cached) {
        try {
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      audioRef.current = a;
      const onFail = () => {
        if (token === tokenRef.current) ttsLive(fallbackText, token);
      };
      a.onplay = () => {
        if (token === tokenRef.current) setSpeaking(true);
      };
      a.onended = () => {
        if (token === tokenRef.current) setSpeaking(false);
      };
      a.onerror = onFail;
      a.play().catch(onFail);
    },
    [hardStop, ttsLive],
  );

  return { narrate, speak: speakText, stop, speaking, supported };
}
