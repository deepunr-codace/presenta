import { beforeEach, describe, expect, it } from "vitest";
import { runTask, useTasks } from "../tasks";

beforeEach(() => {
  (globalThis as { window?: unknown }).window = globalThis;
  useTasks.setState({ tasks: [] });
});

describe("runTask", () => {
  it("shows progress while running and completes", async () => {
    const seen: (number | null)[] = [];
    const out = await runTask("Import", async (report) => {
      report(40, "Halfway");
      seen.push(useTasks.getState().tasks[0].pct);
      return 7;
    });
    expect(out).toBe(7);
    expect(seen).toEqual([40]);
    expect(useTasks.getState().tasks[0]).toMatchObject({ status: "done", pct: 100 });
  });

  it("shows the error on the card and rethrows", async () => {
    await expect(runTask("Import", async () => { throw new Error("Nope"); })).rejects.toThrow("Nope");
    expect(useTasks.getState().tasks[0]).toMatchObject({ status: "error", label: "Nope" });
  });
});
