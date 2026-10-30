"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice narration for the presenter, on top of the browser's own `speechSynthesis` (no keys, no backend, nothing
 * recorded). The hook speaks `text` whenever narration is on, cancels when it is turned off or the slide changes,
 * and remembers the chosen voice, rate and volume in `localStorage`.
 */

export type NarrationVoice = { uri: string; name: string; lang: string };

export type NarrationPrefs = {
  /** `voiceURI` of the chosen voice; empty means the browser's default voice. */
  voiceURI: string;
  /** 0.5 – 2.0, 1 being the voice's normal pace. */
  rate: number;
  /** 0 – 1. */
  volume: number;
};

export const NARRATION_PREFS_KEY = "presenta.narration.prefs";

export const DEFAULT_NARRATION_PREFS: NarrationPrefs = { voiceURI: "", rate: 1, volume: 1 };

const RATE_MIN = 0.5;
const RATE_MAX = 2;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Saved preferences, made safe: a corrupt or hand-edited value falls back to the defaults field by field. */
export function readNarrationPrefs(): NarrationPrefs {
  if (typeof window === "undefined") return DEFAULT_NARRATION_PREFS;
  try {
    const raw = JSON.parse(window.localStorage.getItem(NARRATION_PREFS_KEY) ?? "null") as Partial<NarrationPrefs> | null;
    if (!raw || typeof raw !== "object") return DEFAULT_NARRATION_PREFS;
    return {
      voiceURI: typeof raw.voiceURI === "string" ? raw.voiceURI.slice(0, 300) : "",
      rate: Number.isFinite(raw.rate) ? clamp(Number(raw.rate), RATE_MIN, RATE_MAX) : 1,
      volume: Number.isFinite(raw.volume) ? clamp(Number(raw.volume), 0, 1) : 1,
    };
  } catch {
    return DEFAULT_NARRATION_PREFS;
  }
}

function saveNarrationPrefs(prefs: NarrationPrefs): void {
  try {
    window.localStorage.setItem(NARRATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // A full or blocked storage is not worth telling the presenter about; the choice just does not persist.
  }
}

function listVoices(): NarrationVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
}

/** The chosen voice, or one that reads the page's language, or the browser default (null). */
function pickVoice(voices: NarrationVoice[], uri: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") return null;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return null;
  const chosen = uri ? all.find((v) => v.voiceURI === uri) : undefined;
  if (chosen) return chosen;
  const lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  return all.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? all[0] ?? null;
}

/**
 * Speak `text` while `enabled`. Call it unconditionally: it tears the current utterance down on every slide change,
 * on disable, and on unmount, so nothing keeps talking after the presenter is gone.
 */
export function useNarration(text: string, enabled: boolean) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [voices, setVoices] = useState<NarrationVoice[]>(listVoices);
  const [prefs, setPrefsState] = useState<NarrationPrefs>(readNarrationPrefs);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  /** Bumped by `replay` so the same slide can be read again from the top. */
  const [replayKey, setReplayKey] = useState(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  // Voices arrive asynchronously in most browsers (Chrome starts empty), so listen for the list.
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const onChange = () => setVoices(listVoices());
    synth.addEventListener("voiceschanged", onChange);
    return () => synth.removeEventListener("voiceschanged", onChange);
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (!enabled || !text) {
      synth.cancel();
      utterance.current = null;
      return;
    }

    const speak = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(voices, prefs.voiceURI);
    if (voice) {
      speak.voice = voice;
      speak.lang = voice.lang;
    }
    speak.rate = clamp(prefs.rate, RATE_MIN, RATE_MAX);
    speak.volume = clamp(prefs.volume, 0, 1);
    speak.pitch = 1;

    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        setSpeaking(false);
        setPaused(false);
      }
    };
    speak.onstart = () => {
      if (!cancelled) setSpeaking(true);
    };
    speak.onend = finish;
    speak.onerror = finish;

    utterance.current = speak;
    // Chrome drops an utterance queued in the same tick as `cancel()`, so queue it on the next task.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      synth.cancel();
      synth.speak(speak);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      synth.cancel();
      utterance.current = null;
    };
  }, [supported, enabled, text, prefs.rate, prefs.volume, prefs.voiceURI, voices, replayKey]);

  const setPrefs = useCallback((patch: Partial<NarrationPrefs>) => {
    setPrefsState((prev) => {
      const next: NarrationPrefs = {
        voiceURI: patch.voiceURI ?? prev.voiceURI,
        rate: clamp(patch.rate ?? prev.rate, RATE_MIN, RATE_MAX),
        volume: clamp(patch.volume ?? prev.volume, 0, 1),
      };
      saveNarrationPrefs(next);
      return next;
    });
  }, []);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  /** Stop at once; used when narration is switched off or the presenter leaves. */
  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utterance.current = null;
    setSpeaking(false);
    setPaused(false);
  }, []);

  const replay = useCallback(() => setReplayKey((k) => k + 1), []);

  return { supported, voices, prefs, setPrefs, speaking, paused, pause, resume, stop, replay, hasText: Boolean(text) };
}
