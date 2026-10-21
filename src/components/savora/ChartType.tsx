import { useEffect, useState } from "react";
import { BarChart3, PieChart as PieIcon } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ChartType = "bar" | "pie";

export const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-1)",
];

/** Remembers the chosen chart type per chart on this device. */
export function useChartType(key: string, initial: ChartType = "bar") {
  const storageKey = `savora:chart-type:${key}`;
  const [type, setType] = useState<ChartType>(initial);
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "bar" || saved === "pie") setType(saved);
  }, [storageKey]);
  const update = (next: ChartType) => {
    setType(next);
    window.localStorage.setItem(storageKey, next);
  };
  return [type, update] as const;
}

export function ChartTypeToggle({
  value,
  onChange,
  label,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as ChartType)}
      aria-label={`${label} chart type`}
    >
      <ToggleGroupItem value="bar" aria-label="Bar chart" className="gap-1.5 px-2.5 text-xs">
        <BarChart3 className="size-3.5" /> Bar
      </ToggleGroupItem>
      <ToggleGroupItem value="pie" aria-label="Pie chart" className="gap-1.5 px-2.5 text-xs">
        <PieIcon className="size-3.5" /> Pie
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function SimplePie({
  data,
  valueLabel,
  formatValue,
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  valueLabel: string;
  formatValue?: (value: number) => string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((a, d) => a + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius="45%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="var(--color-card)"
          label={({ percent }) => (percent && percent >= 0.06 ? `${Math.round(percent * 100)}%` : "")}
          labelLine={false}
        >
          {slices.map((d, i) => (
            <Cell key={d.name} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => {
            const n = Number(v);
            const pct = total ? ` (${Math.round((n / total) * 100)}%)` : "";
            return [`${formatValue ? formatValue(n) : n}${pct}`, valueLabel];
          }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
