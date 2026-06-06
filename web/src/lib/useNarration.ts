"use client";
/* ============================================================
   useNarration — the "tour guide" voice.

   Latency killer: as soon as a graph loads, EVERY node's narration is
   pre-generated via Gemini TTS in the background and cached as a blob URL.
   By the time the user clicks, the audio is already in memory → instant.

   narrate(id) playback order:
     1. cached blob (prefetched Gemini TTS)  → instant
     2. live /api/tts (if not prefetched yet) → ~1-2s
     3. browser Web Speech                    → last resort

   Barge-in: every narrate() bumps a token + aborts in-flight requests, so
   rapid clicks never stack.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";

const RATE = 1.12;

interface NarrNode {
  id: string;
  narration?: string;
}

export function useNarration(nodes?: NarrNode[]) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobCache = useRef<Map<string, string>>(new Map()); // nodeId → blob URL
  const tokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // browser voice (fallback only)
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

  // Background-prefetch ALL node audio for the current graph.
  const nodesKey = nodes?.map((n) => n.id).join(",");
  useEffect(() => {
    if (!nodes || nodes.length === 0 || typeof window === "undefined") return;
    let cancelled = false;
    const cache = blobCache.current;

    const fetchOne = async (n: NarrNode) => {
      if (cancelled || cache.has(n.id) || !n.narration) return;
      try {
        // static pre-rendered file first (cheap if it exists)
        const staticUrl = `/narration/${encodeURIComponent(n.id)}.wav`;
        const head = await fetch(staticUrl);
        if (cancelled) return;
        if (head.ok) {
          cache.set(n.id, staticUrl);
          return;
        }
      } catch {
        /* fall through to live TTS */
      }
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: n.narration }),
        });
        if (cancelled || !res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        cache.set(n.id, URL.createObjectURL(blob));
      } catch {
        /* leave uncached → narrate() will do it live on click */
      }
    };

    // small concurrency so we don't fire 9 calls at once
    (async () => {
      const queue = [...nodes];
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length && !cancelled) {
          const n = queue.shift();
          if (n) await fetchOne(n);
        }
      });
      await Promise.all(workers);
    })();

    return () => {
      cancelled = true;
      // revoke blob URLs from the previous graph (keep static-file URLs)
      for (const url of cache.values()) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      }
      cache.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesKey]);

  const hardStop = useCallback(() => {
    tokenRef.current += 1;
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const stop = useCallback(() => hardStop(), [hardStop]);

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

  const playUrl = useCallback((url: string, token: number, onFail: () => void) => {
    if (token !== tokenRef.current) return;
    const a = new Audio(url);
    a.playbackRate = RATE;
    audioRef.current = a;
    a.onplay = () => {
      if (token === tokenRef.current) setSpeaking(true);
    };
    a.onended = () => {
      if (token === tokenRef.current) setSpeaking(false);
    };
    a.onerror = onFail;
    a.play().catch(onFail);
  }, []);

  // live TTS (only when a node wasn't prefetched yet)
  const ttsLive = useCallback(
    async (nodeId: string, text: string, token: number) => {
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
        if (token !== tokenRef.current) return;
        if (!res.ok) throw new Error("tts http");
        const blob = await res.blob();
        if (token !== tokenRef.current) return;
        const url = URL.createObjectURL(blob);
        blobCache.current.set(nodeId, url); // cache for next time
        playUrl(url, token, () => speakText(text, token));
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        speakText(text, token);
      }
    },
    [playUrl, speakText],
  );

  const narrate = useCallback(
    (nodeId: string, fallbackText = "") => {
      hardStop();
      const token = tokenRef.current;
      const cached = blobCache.current.get(nodeId);
      if (cached) {
        playUrl(cached, token, () => ttsLive(nodeId, fallbackText, token));
      } else {
        ttsLive(nodeId, fallbackText, token);
      }
    },
    [hardStop, playUrl, ttsLive],
  );

  return { narrate, speak: speakText, stop, speaking, supported };
}
