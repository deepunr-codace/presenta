import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { IconChip } from "@/components/ui-kit/IconChip";

type Props = {
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
};

/** Clickable taupe card: icon plate, title, body and the call to action as an ink link with an arrow. */
export function OptionCard({ icon, title, body, cta, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} data-clickable className="ps-glass ps-focus group min-h-[180px] items-stretch text-left">
      <span className="ps-glass-head">
        <IconChip icon={icon} />
      </span>
      <span className="ps-title">{title}</span>
      <span className="ps-body mt-1">{body}</span>
      <span className="ps-link mt-auto inline-flex items-center gap-1.5 pt-5 group-hover:[text-decoration-color:var(--ps-ink)]">
        {cta} <ArrowRight size={14} weight="bold" />
      </span>
    </button>
  );
}
