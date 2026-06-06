"use client";
/* ============================================================
   useNarration — plays pre-rendered Gemini TTS audio per node
   (public/narration/<node_id>.wav), with the browser's Web Speech
   API as a graceful fallback when no audio file exists (e.g. a
   live-generated repo whose narration wasn't pre-rendered).
   narrate(nodeId, fallbackText) is the single entry point.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";

export function useNarration() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  // Web Speech fallback (used only when an audio file is missing).
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 1.02;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  // Primary: play pre-rendered Gemini TTS audio for this node.
  const narrate = useCallback(
    (nodeId: string, fallbackText = "") => {
      // barge-in: stop whatever's playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      const a = new Audio(`/narration/${encodeURIComponent(nodeId)}.wav`);
      audioRef.current = a;
      a.onplay = () => setSpeaking(true);
      a.onended = () => setSpeaking(false);
      a.onerror = () => {
        // no pre-rendered file → Web Speech fallback
        if (audioRef.current === a) audioRef.current = null;
        speakText(fallbackText);
      };
      a.play().catch(() => speakText(fallbackText));
    },
    [speakText],
  );

  return { narrate, speak: speakText, stop, speaking, supported };
}
