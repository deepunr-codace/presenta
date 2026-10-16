import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  message: ReactNode;
  /** Machine code shown in small mono type under the message. */
  code?: string;
  /** Retry and escape actions; rendered in a row under the text. */
  actions?: ReactNode;
  /** Compact variant for inline use (one line, 12 px padding). */
  compact?: boolean;
  className?: string;
};

/** Danger-tinted alert with an optional title, code and action row. */
export function ErrorNotice({ title, message, code, actions, compact = false, className }: Props) {
  return (
    <div role="alert" className={cn("ps-error", compact && "ps-error-compact", className)}>
      <div className="flex items-start gap-2">
        <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-medium">{title}</p> : null}
          <p className={cn("leading-5", title && "mt-0.5")}>{message}</p>
          {code ? <p className="mt-1 font-mono text-[11px] opacity-80">code: {code}</p> : null}
        </div>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
