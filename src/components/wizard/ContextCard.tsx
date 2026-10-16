import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui-kit/GlassCard";

type Props = { title: string; children: ReactNode; className?: string };

/** Paper card for the wizard's right column. */
export function ContextCard({ title, children, className }: Props) {
  return (
    <GlassCard paper title={title} className={cn("p-5", className)} headClassName="mb-3 min-h-0">
      {children}
    </GlassCard>
  );
}
