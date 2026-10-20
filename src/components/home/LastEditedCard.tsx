"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react";
import type { DeckSummary } from "@/lib/persist";
import { timeAgo } from "@/lib/time";
import { ArrowButton } from "@/components/ui-kit/ArrowButton";
import { StatCard } from "./StatCard";

type Props = { summary: DeckSummary | null };

/** "Last edited" stat tile: deck name as the value, age and slide count as the caption, an open button in the label row. */
export function LastEditedCard({ summary }: Props) {
  const icon = <ClockCounterClockwise />;
  if (!summary) return <StatCard title="Last edited" icon={icon} value="—" caption="No decks yet" />;
  const title = summary.title || "Untitled deck";
  return (
    <StatCard
      title="Last edited"
      icon={icon}
      value={<span className="block min-w-0 max-w-full truncate text-[22px] leading-9">{title}</span>}
      caption={`${timeAgo(summary.updatedAt)} · ${summary.slideCount} slide${summary.slideCount === 1 ? "" : "s"}`}
      action={<ArrowButton label={`Open ${title}`} href={`/deck/${summary.id}`} />}
    />
  );
}
