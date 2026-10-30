"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptEntry } from "@/lib/presenter-coach";

type SpeechChunk = { transcript: string };
type SpeechResult = { isFinal: boolean; 0?: SpeechChunk };
type SpeechEvent = Event & { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechError = Event & { error?: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: SpeechError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
function recognitionConstructor(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as RecognitionWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

/** Keeps interim and final speech results in memory only; audio and transcript are never sent to Presenta. */
export function useSpeechTranscript() {
  const [supported, setSupported] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const listening = useRef(false);
  const slideIndex = useRef(0);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => setSupported(Boolean(recognitionConstructor())), []);
  useEffect(() => () => {
    listening.current = false;
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    recognition.current?.stop();
  }, []);

  const setCurrentSlide = useCallback((value: number) => { slideIndex.current = value; }, []);
  const start = useCallback((initialSlide: number): boolean => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return false;
    setCurrentSlide(initialSlide);
    setError(null);
    setInterim("");
    listening.current = true;
    const instance = new Constructor();
    instance.lang = typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      const finalEntries: TranscriptEntry[] = [];
      const interimParts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) finalEntries.push({ slideIndex: slideIndex.current, text, at: Date.now() });
        else interimParts.push(text);
      }
      if (finalEntries.length) setEntries((current) => [...current, ...finalEntries]);
      setInterim(interimParts.join(" "));
    };
    instance.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listening.current = false;
        setError("Microphone or speech-recognition permission was denied. You can still rehearse with the timer.");
      } else if (event.error && event.error !== "no-speech" && event.error !== "aborted") {
        setError("Speech recognition paused. Check your microphone and browser permissions.");
      }
    };
    instance.onend = () => {
      if (!listening.current) return;
      retryTimer.current = window.setTimeout(() => {
        if (!listening.current) return;
        try { instance.start(); }
        catch { setError("Speech recognition stopped. You can continue the timed rehearsal."); }
      }, 250);
    };
    recognition.current = instance;
    try { instance.start(); }
    catch (cause) {
      listening.current = false;
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Microphone permission was denied. You can continue with the timed rehearsal."
        : "Could not start speech recognition. You can continue the timed rehearsal.");
    }
    return true;
  }, [setCurrentSlide]);

  const stop = useCallback(() => {
    listening.current = false;
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
    try { recognition.current?.stop(); } catch { /* the browser may already have stopped */ }
    recognition.current = null;
    setInterim("");
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    setInterim("");
    setError(null);
  }, []);

  return { supported, entries, interim, error, start, stop, clear, setCurrentSlide };
}
