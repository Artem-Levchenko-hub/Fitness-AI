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

type Point = { date: string; volume: number; sets: number; reps: number };

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

  return (
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
          fill="var(--primary)"
          radius={[6, 6, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
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
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)} тыс.`;
  return String(Math.round(v));
}

function EmptyChart({ hint }: { hint: string }) {
  return (
    <div className="bg-muted/40 text-muted-foreground flex h-[220px] items-center justify-center rounded-xl text-sm">
      {hint}
    </div>
  );
}
