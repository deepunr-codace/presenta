import { describe, expect, it } from "vitest";
import { generateProgress, pushProgress, writtenSlides } from "../generate-progress";

describe("writtenSlides", () => {
  it("advances one slide per tick while writing and holds at n - 1", () => {
    const running = { phase: "running", stage: 0 } as const;
    expect(writtenSlides(running, 5, 0)).toBe(0);
    expect(writtenSlides(running, 5, 3)).toBe(3);
    expect(writtenSlides(running, 5, 4)).toBe(4);
    expect(writtenSlides(running, 5, 40)).toBe(4);
  });

  it("counts every slide once writing is over", () => {
    expect(writtenSlides({ phase: "running", stage: 1 }, 5, 0)).toBe(5);
    expect(writtenSlides({ phase: "running", stage: 3 }, 5, 99)).toBe(5);
    expect(writtenSlides({ phase: "done" }, 5, 0)).toBe(5);
  });

  it("is zero without an outline or on error", () => {
    expect(writtenSlides({ phase: "running", stage: 0 }, 0, 7)).toBe(0);
    expect(writtenSlides({ phase: "error" }, 5, 7)).toBe(0);
  });
});

describe("generateProgress", () => {
  it("matches the numeral and only reaches 1 when done", () => {
    const running = { phase: "running", stage: 0 } as const;
    expect(generateProgress(running, 4, 2)).toBe(0.5);
    expect(generateProgress(running, 4, 50)).toBe(0.75);
    expect(generateProgress({ phase: "running", stage: 2 }, 4, 0)).toBe(1);
    expect(generateProgress({ phase: "done" }, 4, 0)).toBe(1);
    expect(generateProgress({ phase: "done" }, 0, 0)).toBe(1);
    expect(generateProgress(running, 0, 3)).toBe(0);
  });

  it("never decreases over the life of a run", () => {
    const n = 6;
    const samples: number[] = [];
    for (let tick = 0; tick < 12; tick++) samples.push(generateProgress({ phase: "running", stage: 0 }, n, tick));
    for (const stage of [1, 2, 3]) samples.push(generateProgress({ phase: "running", stage }, n, 12));
    samples.push(generateProgress({ phase: "done" }, n, 12));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    expect(samples[samples.length - 1]).toBe(1);
  });
});

describe("pushProgress", () => {
  it("appends only rising values and caps the length", () => {
    let series = [0];
    series = pushProgress(series, 0.2, 4);
    series = pushProgress(series, 0.2, 4);
    series = pushProgress(series, 0.1, 4);
    series = pushProgress(series, 0.5, 4);
    series = pushProgress(series, 0.75, 4);
    series = pushProgress(series, 1, 4);
    expect(series).toEqual([0.2, 0.5, 0.75, 1]);
  });

  it("returns the same array when nothing changes", () => {
    const series = [0, 0.5];
    expect(pushProgress(series, 0.5, 10)).toBe(series);
  });
});
