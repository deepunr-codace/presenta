"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useTasks, type Task } from "@/lib/tasks";

const TIPS = [
  "Every text box in an imported deck stays fully editable.",
  "Press ⌘K or Ctrl+K to search decks, pages and templates.",
  "Brand kit colours and fonts can be applied to any deck.",
  "Use Present to rehearse with the Presenter Coach.",
  "Starred decks stay pinned in your sidebar.",
  "Templates carry their look to decks you generate.",
];

function TaskCard({ task }: { task: Task }) {
  const [tip, setTip] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (task.status !== "running") return;
    const t = window.setInterval(() => {
      setTip((i) => (i + 1) % TIPS.length);
    }, 3200);
    const e = window.setInterval(() => setElapsed(Math.floor((Date.now() - task.startedAt) / 1000)), 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(e);
    };
  }, [task.status, task.startedAt]);

  const running = task.status === "running";
  const determinate = task.pct !== null;
  return (
    <div className="ps-task" data-status={task.status} role="status" aria-live="polite">
      <div className="ps-task-head">
        <span className="ps-task-icon" aria-hidden>
          {task.status === "done" ? <CheckCircle size={16} weight="fill" /> : task.status === "error" ? <WarningCircle size={16} weight="fill" /> : <Sparkle size={14} weight="fill" />}
        </span>
        <strong>{task.title}</strong>
        {running && determinate ? <span className="ps-task-pct">{task.pct}%</span> : null}
      </div>
      <p className="ps-task-label">{task.label}</p>
      {running || task.status === "done" ? (
        <div className="ps-task-bar" data-indeterminate={running && !determinate ? "true" : undefined} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate ? task.pct ?? 0 : undefined}>
          <span style={determinate || task.status === "done" ? { width: `${task.pct ?? 100}%` } : undefined} />
        </div>
      ) : null}
      {running ? (
        <p className="ps-task-tip">
          {elapsed >= 4 ? `${elapsed}s · ` : ""}
          {TIPS[tip]}
        </p>
      ) : null}
    </div>
  );
}

/** Floating cards for long-running jobs (imports, conversions, publishing). Mounted once in the app shell. */
export function TaskProgressHost() {
  const tasks = useTasks((s) => s.tasks);
  if (!tasks.length) return null;
  return (
    <div className="ps-task-host">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}
