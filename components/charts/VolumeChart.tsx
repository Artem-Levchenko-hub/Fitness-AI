"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TREND_LABEL, trendStatus } from "@/lib/domain/progression/trend";
import { TREND_TONE } from "@/lib/ui/trend-tone";
import { cn } from "@/lib/utils";

type Point = { date: string; volume: number; sets: number; reps: number };

/** Зона нечувствительности тренда объёма как доля от стартового значения.
 *  Объём (тоннаж) — крупная величина в тысячах, фиксированный epsilon бессмыслен;
 *  колебание первой→последней точки <5% считаем шумом, не ростом/регрессом. */
const VOLUME_TREND_EPSILON_RATIO = 0.05;

export function VolumeBarChart({
  data,
  granularity = "day",
}: {
  data: Point[];
  granularity?: "day" | "week";
}) {
  if (data.length === 0) {
    return <EmptyChart hint="Нет тренировок в выбранном периоде" />;
  }

  // Тренд за период: первая точка → последняя (как в OneRmTrendChart).
  // < 2 точек — нет истории для сравнения (prev=null → "new").
  // Больше объёма = прогресс (higherIsBetter по умолчанию).
  const last = data[data.length - 1].volume;
  const prev = data.length >= 2 ? data[0].volume : null;
  const status = trendStatus(prev, last, {
    epsilon: prev != null ? Math.abs(prev) * VOLUME_TREND_EPSILON_RATIO : 0,
  });
  const tone = TREND_TONE[status];
  const deltaVol = prev != null ? last - prev : null;

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
        {deltaVol != null && status !== "stagnant" ? (
          <span className={cn("tabular text-xs font-medium", tone.text)}>
            {deltaVol > 0 ? "+" : "−"}
            {formatVolume(Math.abs(deltaVol))}
          </span>
        ) : null}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="2 4"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatTick(v, granularity)}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatVolume(Number(v))}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={((value: number | string, name: string) => {
            const num = typeof value === "number" ? value : Number(value);
            if (name === "volume") return [formatVolume(num), "Объём"];
            return [String(value), name];
          }) as never}
          labelFormatter={(v) => formatTooltipLabel(String(v), granularity)}
        />
        <Bar
          dataKey="volume"
          fill={tone.stroke}
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTick(v: string, granularity: "day" | "week"): string {
  const d = new Date(v);
  if (granularity === "week") {
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function formatTooltipLabel(v: string, granularity: "day" | "week"): string {
  const d = new Date(v);
  if (granularity === "week") {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}`;
  }
  return d.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="bg-muted/40 text-muted-foreground flex h-[220px] items-center justify-center rounded-xl text-sm">
      {hint}
    </div>
  );
}
