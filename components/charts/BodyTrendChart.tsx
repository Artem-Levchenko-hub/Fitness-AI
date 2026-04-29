"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BodyPoint = {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
};

export function BodyTrendChart({ data }: { data: BodyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex h-[220px] items-center justify-center rounded-xl text-sm">
        Замеров пока нет
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="2 4"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "short",
            })
          }
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="weight"
          orientation="left"
          tickFormatter={(v) => `${Math.round(Number(v))}`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <YAxis
          yAxisId="bf"
          orientation="right"
          tickFormatter={(v) => `${Math.round(Number(v))}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={((v: unknown, n: string) => {
            const num = Number(v);
            if (n === "weightKg") return [`${num.toFixed(1)} кг`, "Вес"];
            if (n === "bodyFatPct") return [`${num.toFixed(1)}%`, "% жира"];
            return [String(v), n];
          }) as never}
          labelFormatter={(v) =>
            new Date(String(v)).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          }
        />
        <Area
          yAxisId="weight"
          type="monotone"
          dataKey="weightKg"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.12}
          strokeWidth={2}
          connectNulls
        />
        <Line
          yAxisId="bf"
          type="monotone"
          dataKey="bodyFatPct"
          stroke="var(--pr)"
          strokeWidth={2}
          dot={{ fill: "var(--pr)", r: 3 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
