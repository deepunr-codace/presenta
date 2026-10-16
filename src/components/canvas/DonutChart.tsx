import type { ChartElement } from "@/lib/deck/schema";
import { CHART_FONT, SERIES_FILLS, type PlotArea } from "./chart-style";

type Props = { element: ChartElement; plot: PlotArea };

/** Donut built from the first series, with the total in the middle and a legend on the right. */
export function DonutChart({ element, plot }: Props) {
  const values = element.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const size = Math.min(plot.w, plot.h + (element.labels.length ? CHART_FONT + 16 : 0));
  const r = size / 2 - 12;
  const stroke = Math.max(16, r * 0.34);
  const cx = plot.x + r + 12;
  const cy = plot.y + size / 2;
  const circumference = 2 * Math.PI * (r - stroke / 2);
  const starts = values.reduce<number[]>((acc, v, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (values[i - 1] / total) * circumference);
    return acc;
  }, []);
  const legendX = cx + r + 40;
  return (
    <g>
      {values.map((v, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r - stroke / 2}
          fill="none"
          stroke={SERIES_FILLS[i % SERIES_FILLS.length]}
          strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, (v / total) * circumference - 3)} ${circumference}`}
          strokeDashoffset={-starts[i]}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <text x={cx} y={cy + 10} fontSize={Math.max(24, r * 0.4)} fontFamily="var(--deck-display)" fontWeight={600} textAnchor="middle" fill="var(--deck-ink)">
        {Math.round(total)}
      </text>
      {element.labels.map((label, i) => (
        <g key={i} transform={`translate(${legendX}, ${cy - (element.labels.length * 30) / 2 + i * 30 + 14})`}>
          <rect x={0} y={-12} width={14} height={14} rx={4} fill={SERIES_FILLS[i % SERIES_FILLS.length]} />
          <text x={22} y={0} fontSize={CHART_FONT} fill="var(--deck-muted)">
            {label}
            {values[i] !== undefined ? ` · ${Math.round((values[i] / total) * 100)}%` : ""}
          </text>
        </g>
      ))}
    </g>
  );
}
