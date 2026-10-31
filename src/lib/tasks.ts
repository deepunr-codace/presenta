"use client";

import { create } from "zustand";

/** A long-running job shown in the floating progress card. `pct` of null means "working, no measurable progress yet". */
export type Task = { id: string; title: string; label: string; pct: number | null; startedAt: number; status: "running" | "done" | "error" };

type TaskStore = {
  tasks: Task[];
  start: (title: string, label?: string) => string;
  update: (id: string, patch: { label?: string; pct?: number | null }) => void;
  finish: (id: string, status: "done" | "error", label?: string) => void;
  dismiss: (id: string) => void;
};

let counter = 0;

export const useTasks = create<TaskStore>((set, get) => ({
  tasks: [],
  start: (title, label = "Getting started…") => {
    const id = `task-${Date.now()}-${(counter += 1)}`;
    set((s) => ({ tasks: [...s.tasks, { id, title, label, pct: null, startedAt: Date.now(), status: "running" }] }));
    return id;
  },
  update: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, pct: patch.pct === undefined ? t.pct : patch.pct } : t)) })),
  finish: (id, status, label) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, label: label ?? t.label, pct: status === "done" ? 100 : t.pct } : t)) }));
    window.setTimeout(() => get().dismiss(id), status === "done" ? 1600 : 6000);
  },
  dismiss: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}));

export type ReportProgress = (pct: number | null, label?: string) => void;

/** Runs `fn` while showing a progress card; `fn` reports its own progress. Errors are shown on the card, then rethrown. */
export async function runTask<T>(title: string, fn: (report: ReportProgress) => Promise<T>, doneLabel = "Done"): Promise<T> {
  const { start, update, finish } = useTasks.getState();
  const id = start(title);
  try {
    const out = await fn((pct, label) => update(id, { pct: pct === null ? null : Math.max(0, Math.min(100, Math.round(pct))), ...(label ? { label } : {}) }));
    finish(id, "done", doneLabel);
    return out;
  } catch (err) {
    finish(id, "error", err instanceof Error ? err.message : "Something went wrong.");
    throw err;
  }
}
