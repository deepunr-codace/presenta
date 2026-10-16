/**
 * Progress model for the Generate step. One series drives the numeral, the percent and the
 * sparkline, so they always agree, and it never moves backwards.
 */

export type GeneratePhase = { phase: "running"; stage: number } | { phase: "done" } | { phase: "error" };

/**
 * Slides written so far. While the model writes (stage 0) the counter advances one slide per
 * tick and holds at `n - 1` until the response arrives; every later stage counts all slides.
 */
export function writtenSlides(status: GeneratePhase, n: number, tick: number): number {
  if (status.phase === "done") return n;
  if (status.phase !== "running") return 0;
  if (status.stage >= 1) return n;
  return Math.min(Math.max(0, n - 1), Math.max(0, tick));
}

/** Overall progress in 0..1 derived from the written count; 1 only when the deck is saved. */
export function generateProgress(status: GeneratePhase, n: number, tick: number): number {
  if (status.phase === "done") return 1;
  if (status.phase !== "running" || n <= 0) return 0;
  return writtenSlides(status, n, tick) / n;
}

/** Append `value` to a monotonic series (ignored unless it rises), keeping at most `max` samples. */
export function pushProgress(series: number[], value: number, max: number): number[] {
  const last = series[series.length - 1] ?? -1;
  if (value <= last) return series;
  return [...series, value].slice(-max);
}
