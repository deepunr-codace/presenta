import type { Deck, Theme } from "@/lib/deck/schema";
import { timeAgo } from "@/lib/time";
import { ThemeSwatch } from "@/components/editor/ThemeSwatch";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";

const FONT_PAIR_LABEL: Record<NonNullable<NonNullable<Deck["meta"]["brand"]>["fontPair"]>, string> = {
  inter: "Inter Tight / Inter",
  dm: "DM Sans",
  oswald: "Oswald / Roboto",
  roboto: "Roboto",
};

type Props = { deck: Deck; theme: Theme };

/** Details tab on the review page: brief, outline, brand and theme/dates, read-only. */
export function DeckDetails({ deck, theme }: Props) {
  const { brief, outline, brand, audience, tone } = deck.meta;
  const rows: { label: string; value: string }[] = [];
  if (brief?.topic) rows.push({ label: "Topic", value: brief.topic });
  const audienceText = brief?.audience ?? audience;
  if (audienceText) rows.push({ label: "Audience", value: audienceText });
  if (brief?.goal) rows.push({ label: "Goal", value: brief.goal });
  if (brief?.angle) rows.push({ label: "Angle", value: brief.angle });
  if (tone) rows.push({ label: "Tone", value: tone });
  if (brief?.mustInclude?.length) rows.push({ label: "Must include", value: brief.mustInclude.join(", ") });
  const hasBrand = Boolean(brand?.company || brand?.accent || brand?.fontPair || brand?.logoDataUrl);

  return (
    <>
      <PropertyGroup title="Brief">
        {rows.length ? (
          <dl className="ps-details">
            {rows.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ps-caption">No brief was recorded for this deck. Decks built from the chat or paste flow show their topic, audience and goal here.</p>
        )}
      </PropertyGroup>
      <PropertyGroup title="Outline">
        <dl className="ps-details">
          <div>
            <dt>Slides</dt>
            <dd>
              {deck.slides.length} in the deck{outline ? ` · ${outline.slides.length} planned` : ""}
            </dd>
          </div>
          {outline?.slides.length ? (
            <div>
              <dt>Planned titles</dt>
              <dd>
                <ol className="list-decimal space-y-0.5 pl-4 text-[12px] leading-[18px] text-[var(--ps-smoke)]">
                  {outline.slides.map((s, i) => (
                    <li key={i}>{s.title}</li>
                  ))}
                </ol>
              </dd>
            </div>
          ) : null}
        </dl>
      </PropertyGroup>
      <PropertyGroup title="Brand">
        {hasBrand && brand ? (
          <dl className="ps-details">
            {brand.logoDataUrl ? (
              <div>
                <dt>Logo</dt>
                <dd>
                  <span className="ps-preview ps-preview-logo-wide">
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded data URL */}
                    <img src={brand.logoDataUrl} alt={brand.company ? `${brand.company} logo` : "Logo"} />
                  </span>
                </dd>
              </div>
            ) : null}
            {brand.company ? (
              <div>
                <dt>Company</dt>
                <dd>{brand.company}</dd>
              </div>
            ) : null}
            {brand.accent ? (
              <div>
                <dt>Accent</dt>
                <dd className="flex items-center gap-2">
                  <span className="inline-block size-3.5 rounded-full shadow-[inset_0_0_0_1px_var(--ps-line-2)]" style={{ background: brand.accent }} aria-hidden />
                  <span className="font-mono text-[12px] text-[var(--ps-smoke)]">{brand.accent.toUpperCase()}</span>
                </dd>
              </div>
            ) : null}
            {brand.fontPair ? (
              <div>
                <dt>Fonts</dt>
                <dd>{FONT_PAIR_LABEL[brand.fontPair]}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="ps-caption">No brand overrides. The theme&apos;s accent and fonts are used.</p>
        )}
      </PropertyGroup>
      <PropertyGroup title="Theme and dates">
        <dl className="ps-details">
          <div>
            <dt>Theme</dt>
            <dd className="flex items-center gap-1.5">
              <ThemeSwatch pair={theme.swatch} className="h-3 w-5 rounded-[2px]" />
              {theme.name}
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{timeAgo(deck.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{timeAgo(deck.updatedAt)}</dd>
          </div>
        </dl>
      </PropertyGroup>
    </>
  );
}
