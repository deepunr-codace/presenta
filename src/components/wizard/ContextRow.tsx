import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value?: string;
  placeholder?: string;
};

/** Definition row in a context card: label left, value (or an upright ink-3 placeholder) right. */
export function ContextRow({ label, value, placeholder = "Not set" }: Props) {
  const has = Boolean(value?.trim());
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 text-[13px] leading-[18px]">
      <dt className="text-[var(--ps-smoke)]">{label}</dt>
      <dd className={cn("min-w-0 break-words", has ? "text-[var(--ps-ink)]" : "text-[var(--ps-ash)]")}>{has ? value : placeholder}</dd>
    </div>
  );
}
