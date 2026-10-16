"use client";

import { Plus, X } from "@phosphor-icons/react";
import type { ChartElement } from "@/lib/deck/schema";
import type { ElementPatch } from "@/store/deck-store";
import { NumInput } from "@/components/ui-kit/NumInput";
import { PropertyGroup } from "@/components/ui-kit/PropertyGroup";
import { PropertyRow } from "@/components/ui-kit/PropertyRow";
import { Segmented } from "@/components/ui-kit/Segmented";
import { TextInput } from "@/components/ui-kit/TextInput";
import { opts } from "@/components/ui-kit/options";

const MAX_LABELS = 12;
const MAX_SERIES = 4;

type Props = { el: ChartElement; patch: (p: ElementPatch) => void };

/** Chart kind plus a compact editable table: one column per label, one row per series. */
export function ChartProps({ el, patch }: Props) {
  const labels = el.labels;
  const series = el.series;

  const setLabel = (i: number, v: string) => patch({ labels: labels.map((l, j) => (j === i ? v : l)) });
  const setName = (s: number, v: string) => patch({ series: series.map((row, j) => (j === s ? { ...row, name: v } : row)) });
  const setValue = (s: number, i: number, v: number) => patch({ series: series.map((row, j) => (j === s ? { ...row, values: labels.map((_, k) => (k === i ? v : (row.values[k] ?? 0))) } : row)) });

  const addLabel = () => {
    if (labels.length >= MAX_LABELS) return;
    patch({ labels: [...labels, `L${labels.length + 1}`], series: series.map((row) => ({ ...row, values: [...labels.map((_, k) => row.values[k] ?? 0), 0] })) });
  };
  const removeLabel = (i: number) => {
    if (labels.length <= 1) return;
    patch({ labels: labels.filter((_, j) => j !== i), series: series.map((row) => ({ ...row, values: labels.map((_, k) => row.values[k] ?? 0).filter((_, j) => j !== i) })) });
  };
  const addSeries = () => {
    if (series.length >= MAX_SERIES) return;
    patch({ series: [...series, { name: `Series ${series.length + 1}`, values: labels.map(() => 0) }] });
  };
  const removeSeries = (s: number) => {
    if (series.length <= 1) return;
    patch({ series: series.filter((_, j) => j !== s) });
  };

  return (
    <PropertyGroup title="Chart">
      <PropertyRow label="Kind">
        <Segmented aria-label="Chart kind" value={el.kind} options={opts(["bar", "line", "area", "donut"] as const)} onChange={(kind) => patch({ kind })} />
      </PropertyRow>
      <div className="overflow-x-auto">
        <table className="ps-table" aria-label="Chart data">
          <thead>
            <tr>
              <th className="min-w-[72px]">Series</th>
              {labels.map((label, i) => (
                <th key={i} className="min-w-[56px]">
                  <div className="flex items-center gap-0.5">
                    <TextInput aria-label={`Label ${i + 1}`} value={label} onCommit={(v) => setLabel(i, v)} />
                    <button type="button" className="ps-iconbtn ps-iconbtn-xs" aria-label={`Remove label ${label}`} disabled={labels.length <= 1} onClick={() => removeLabel(i)}>
                      <X size={10} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-6">
                <button type="button" className="ps-iconbtn ps-iconbtn-xs" aria-label="Add label" disabled={labels.length >= MAX_LABELS} onClick={addLabel}>
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((row, s) => (
              <tr key={s}>
                <td>
                  <TextInput aria-label={`Series ${s + 1} name`} value={row.name} onCommit={(v) => setName(s, v)} />
                </td>
                {labels.map((_, i) => (
                  <td key={i}>
                    <NumInput aria-label={`${row.name} ${labels[i]}`} value={row.values[i] ?? 0} digits={2} step={1} onCommit={(v) => setValue(s, i, v)} />
                  </td>
                ))}
                <td>
                  <button type="button" className="ps-iconbtn ps-iconbtn-xs" aria-label={`Remove ${row.name}`} disabled={series.length <= 1} onClick={() => removeSeries(s)}>
                    <X size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="ps-btn self-start" onClick={addSeries} disabled={series.length >= MAX_SERIES}>
        <Plus size={12} /> Add series
      </button>
    </PropertyGroup>
  );
}
