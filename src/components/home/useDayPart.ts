"use client";

import { useSyncExternalStore } from "react";

export type DayPart = "morning" | "afternoon" | "evening";

function dayPart(): DayPart {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

const noSubscribe = () => () => {};

/** Client-only time of day; the server render (and hydration) uses null, so the two never disagree. */
export function useDayPart(): DayPart | null {
  return useSyncExternalStore(noSubscribe, dayPart, () => null);
}
