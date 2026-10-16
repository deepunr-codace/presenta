import type { ReactNode } from "react";
import type { ChartElement } from "@/lib/deck/schema";
import { CHART_FONT, SERIES_FILLS } from "./chart-style";
import { DonutChart } from "./DonutChart";

type Props = { element: ChartElement };

/** Bar, line, area or donut chart drawn as inline SVG in stage units. */
export function ChartView({ element }: Props) {
  const { w, h, kind, labels, series } = element;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const legend = series.length > 1;
  const legendH = legend ? CHART_FONT + 16 : 0;
  const labelH = labels.length ? CHART_FONT + 16 : 0;
  const plot = { x: 0, y: legendH, w, h: Math.max(10, h - legendH - labelH) };

  let body: ReactNode = null;
  if (kind === "donut") {
    body = <DonutChart element={element} plot={plot} />;
  } else if (kind === "bar") {
    const groups = labels.length || Math.max(...series.map((s) => s.values.length), 1);
    const groupW = plot.w / groups;
    const barGap = groupW * 0.12;
    const barW = (groupW - barGap * 2) / Math.max(series.length, 1);
    body = (
      <g>
        <line x1={0} y1={plot.y + plot.h} x2={w} y2={plot.y + plot.h} stroke="var(--deck-line)" strokeWidth={2} />
        {series.map((s, si) =>
          s.values.slice(0, groups).map((v, i) => {
            const bh = (v / maxValue) * (plot.h - 8);
            const x = i * groupW + barGap + si * barW;
            return <rect key={`${si}-${i}`} x={x} y={plot.y + plot.h - bh} width={Math.max(2, barW - 4)} height={bh} rx={Math.min(8, barW / 4)} fill={SERIES_FILLS[si % SERIES_FILLS.length]} />;
          }),
        )}
      </g>
    );
  } else {
    const n = Math.max(...series.map((s) => s.values.length), 2);
    const step = plot.w / (n - 1);
    const px = (i: number) => i * step;
    const py = (v: number) => plot.y + plot.h - 4 - (v / maxValue) * (plot.h - 12);
    body = (
      <g>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={0} x2={w} y1={py(maxValue * t)} y2={py(maxValue * t)} stroke="var(--deck-line)" strokeWidth={1} strokeDasharray="4 6" />
        ))}
        <line x1={0} y1={plot.y + plot.h} x2={w} y2={plot.y + plot.h} stroke="var(--deck-line)" strokeWidth={2} />
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${px(i)},${py(v)}`).join(" ");
          const color = SERIES_FILLS[si % SERIES_FILLS.length];
          return (
            <g key={si}>
              {kind === "area" ? <polygon points={`${px(0)},${plot.y + plot.h} ${pts} ${px(s.values.length - 1)},${plot.y + plot.h}`} fill={color} opacity={si === 0 ? 0.18 : 0.12} /> : null}
              <polyline points={pts} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={px(i)} cy={py(v)} r={6} fill="var(--deck-surface)" stroke={color} strokeWidth={3} />
              ))}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" style={{ display: "block", overflow: "visible", fontFamily: "var(--deck-body)" }}>
      {legend ? (
        <g>
          {series.map((s, si) => (
            <g key={si} transform={`translate(${si * 180}, 0)`}>
              <rect x={0} y={4} width={14} height={14} rx={4} fill={SERIES_FILLS[si % SERIES_FILLS.length]} />
              <text x={22} y={16} fontSize={CHART_FONT} fill="var(--deck-muted)">
                {s.name}
              </text>
            </g>
          ))}
        </g>
      ) : null}
      {body}
      {kind !== "donut" && labels.length ? (
        <g>
          {labels.map((label, i) => {
            const cx = kind === "bar" ? (i + 0.5) * (plot.w / labels.length) : i * (plot.w / Math.max(labels.length - 1, 1));
            return (
              <text key={i} x={cx} y={h - 4} fontSize={CHART_FONT} fill="var(--deck-muted)" textAnchor={kind === "bar" ? "middle" : i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}>
                {label}
              </text>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
