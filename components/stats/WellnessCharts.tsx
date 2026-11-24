"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { WellnessDay } from "@/lib/domain/wellness/stats";

function shortDate(iso: string) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export function WellnessCharts({ data }: { data: WellnessDay[] }) {
  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <MetricChart data={data} metric="hours" title="Сон по дням" unit="ч" color="var(--primary)" />
      <MetricChart data={data} metric="proteinG" title="Белок по дням" unit="г" color="var(--pr)" />
    </div>
  );
}

function MetricChart({ data, metric, title, unit, color }: {
  data: WellnessDay[]; metric: "hours" | "proteinG"; title: string; unit: string; color: string;
}) {
  const hasData = data.some((day) => day[metric] !== null);
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold">{title} <span className="text-muted-foreground font-normal">· {unit}</span></h3>
      {hasData ? (
        <div className="h-[170px] w-full" role="img" aria-label={`${title}. Точные значения доступны в истории по дням.`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, "auto"]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" }}
                labelFormatter={(value) => String(value).split("-").reverse().join(".")}
                formatter={(value) => [`${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${unit}`, metric === "hours" ? "Сон" : "Белок"]}
              />
              <Line type="linear" dataKey={metric} stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="bg-muted/40 text-muted-foreground flex h-[170px] items-center justify-center rounded-xl px-4 text-center text-xs">Нет записей за период</div>}
    </div>
  );
}
