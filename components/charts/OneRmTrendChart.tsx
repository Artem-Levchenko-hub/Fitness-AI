"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; estimated1Rm: number };

export function OneRmTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex h-[220px] items-center justify-center rounded-xl text-sm">
        Нет данных по этому упражнению
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
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
          tickFormatter={(v) => `${Math.round(Number(v))}`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={((v: unknown) => [`${Number(v).toFixed(1)} кг`, "e1RM"]) as never}
          labelFormatter={(v) =>
            new Date(String(v)).toLocaleDateString("ru-RU", {
              weekday: "short",
              day: "2-digit",
              month: "long",
            })
          }
        />
        <Line
          type="monotone"
          dataKey="estimated1Rm"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ fill: "var(--primary)", r: 3 }}
          activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
