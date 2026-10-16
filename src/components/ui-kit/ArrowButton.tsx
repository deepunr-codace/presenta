import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ArrowButtonProps = {
  label: string;
  onClick?: MouseEventHandler<HTMLElement>;
  href?: string;
  disabled?: boolean;
  className?: string;
  /** Icon override; defaults to arrow-up-right. */
  icon?: ReactNode;
};

/** 32 px outline circle button with an arrow (`.ps-arrow`); renders a link when `href` is set. */
export function ArrowButton({ label, onClick, href, disabled = false, className, icon }: ArrowButtonProps) {
  const glyph = icon ?? <ArrowUpRight weight="bold" />;
  if (href && !disabled) {
    return (
      <Link href={href} className={cn("ps-arrow ps-focus", className)} aria-label={label} title={label} onClick={onClick}>
        {glyph}
      </Link>
    );
  }
  return (
    <button type="button" className={cn("ps-arrow ps-focus", className)} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {glyph}
    </button>
  );
}
