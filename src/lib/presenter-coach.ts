export type TranscriptEntry = { slideIndex: number; text: string; at: number };
export type SpeechMetrics = { words: number; fillers: number; wordsPerMinute: number };

const FILLER_WORDS = /\b(?:um+|uh+|erm+|er|you know|basically)\b/gi;

export function speechMetrics(entries: TranscriptEntry[], seconds: number): SpeechMetrics {
  const text = entries.map((entry) => entry.text).join(" ").trim();
  const words = text ? text.split(/\s+/u).length : 0;
  const fillers = text.match(FILLER_WORDS)?.length ?? 0;
  return { words, fillers, wordsPerMinute: seconds > 0 ? Math.round(words / (seconds / 60)) : 0 };
}

export function formatCoachTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const remaining = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function slideCoachTip(metrics: SpeechMetrics, seconds: number, recognized: boolean): string {
  if (!recognized) return "No speech was recognized for this slide. Check your browser's microphone permission, then rehearse it again.";
  if (metrics.wordsPerMinute > 170) return "Your pace is quick here. Pause after the main point and let the audience absorb it.";
  if (metrics.wordsPerMinute > 0 && metrics.wordsPerMinute < 105) return "Your pace is measured. Consider tightening long pauses if you need to shorten the talk.";
  if (metrics.words > 0 && (metrics.fillers / metrics.words) * 100 > 4) return "Several filler words were detected. Try a short silent pause when you need time to think.";
  if (seconds > 120) return "This slide took over two minutes. Consider moving a supporting detail to another slide.";
  if (metrics.words > 0) return "Your delivery is within the target pace. Keep the headline clear and leave a beat before advancing.";
  return "Explain the slide's main idea in one sentence, then support it with its strongest point.";
}
