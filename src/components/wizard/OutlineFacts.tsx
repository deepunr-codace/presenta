type Fact = { label: string; value: string };

type Props = { facts: Fact[] };

/**
 * Card strip summarising what the generator will use (slides, tone, language, audience, source).
 * A two-column definition list on narrow screens; one wrapping line from `sm` up.
 */
export function OutlineFacts({ facts }: Props) {
  return (
    <div className="ps-glass gap-2 px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
      <h3 className="ps-label">Will generate</h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px] leading-[18px] sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
        {facts.map((f) => (
          <div key={f.label} className="contents sm:inline-flex sm:items-baseline sm:gap-1.5">
            <dt className="text-[var(--ps-ash)]">{f.label}</dt>
            <dd className="min-w-0 font-medium break-words text-[var(--ps-ink)]">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
