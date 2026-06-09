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

import { TREND_LABEL, trendStatus } from "@/lib/domain/progression/trend";
import { TREND_TONE } from "@/lib/ui/trend-tone";
import { cn } from "@/lib/utils";

type Point = { date: string; estimated1Rm: number };

/** Зона нечувствительности для тренда e1RM (кг): мелкие колебания оценки
 *  максимума — шум, а не прогресс/регресс. */
const E1RM_EPSILON_KG = 0.5;

export function OneRmTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex h-[220px] items-center justify-center rounded-xl text-sm">
        Нет данных по этому упражнению
      </div>
    );
  }

  // Тренд за выбранный период: первая точка → последняя. < 2 точек —
  // нет истории для сравнения (prev=null → "new").
  const last = data[data.length - 1].estimated1Rm;
  const prev = data.length >= 2 ? data[0].estimated1Rm : null;
  const status = trendStatus(prev, last, { epsilon: E1RM_EPSILON_KG });
  const tone = TREND_TONE[status];
  const deltaKg = prev != null ? last - prev : null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            tone.bg,
            tone.text,
          )}
        >
          <span aria-hidden>{tone.icon}</span>
          {TREND_LABEL[status]}
        </span>
        {deltaKg != null && status !== "stagnant" ? (
          <span className={cn("tabular text-xs font-medium", tone.text)}>
            {deltaKg > 0 ? "+" : ""}
            {deltaKg.toFixed(1)} кг
          </span>
        ) : null}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
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
            formatter={
              ((v: unknown) => [`${Number(v).toFixed(1)} кг`, "e1RM"]) as never
            }
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
            stroke={tone.stroke}
            strokeWidth={2}
            dot={{ fill: tone.stroke, r: 3 }}
            activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
