import { Activity, CalendarCheck2, Dumbbell, Gauge, Target } from "lucide-react";

import type { StatsOverviewCopy } from "@/lib/domain/stats/overview";
import type { PeriodInsight } from "@/lib/domain/stats/period-insight";
import type { StatsRange } from "@/lib/domain/stats/range";

const RANGE_LABEL: Record<StatsRange, string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  "365d": "год",
  all: "всё время",
};

export function StatsOverview({
  range,
  copy,
  workouts,
  totalSets,
  totalReps,
  totalTonnageKg,
  loadInsight,
}: {
  range: StatsRange;
  copy: StatsOverviewCopy;
  workouts: number;
  totalSets: number;
  totalReps: number;
  totalTonnageKg: number;
  loadInsight: PeriodInsight;
}) {
  return (
    <section className="bg-primary text-primary-foreground mt-5 overflow-hidden rounded-3xl p-5 shadow-[0_20px_60px_rgba(31,76,52,0.18)] md:p-7">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-70">
        <Target className="size-3.5" aria-hidden />
        Главное за {RANGE_LABEL[range]}
      </div>
      <h2 className="font-serif mt-3 max-w-xl text-2xl font-normal tracking-tight md:text-3xl">
        {copy.headline}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-80">
        {copy.detail}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric
          icon={<CalendarCheck2 className="size-4" aria-hidden />}
          label="Сессии"
          value={workouts.toLocaleString("ru")}
        />
        <Metric
          icon={<Dumbbell className="size-4" aria-hidden />}
          label="Подходы / раунды"
          value={totalSets.toLocaleString("ru")}
        />
        <Metric
          icon={<Activity className="size-4" aria-hidden />}
          label="Повторы"
          value={totalReps.toLocaleString("ru")}
        />
        <Metric
          icon={<Gauge className="size-4" aria-hidden />}
          label="Внешняя нагрузка"
          value={formatTonnage(totalTonnageKg)}
        />
      </dl>

      <div className="mt-5 rounded-2xl bg-white/10 p-4">
        <p className="text-xs font-semibold">Следующий ориентир</p>
        <p className="mt-1 text-sm leading-relaxed opacity-80">{copy.nextStep}</p>
      </div>

      <p className="mt-4 text-xs leading-relaxed opacity-65">
        {loadInsight.headline}
        {loadInsight.pct != null
          ? ` (${loadInsight.pct > 0 ? "+" : ""}${loadInsight.pct}%)`
          : ""}
        . Тоннаж показывает изменение внешней нагрузки, но сам по себе не
        доказывает рост силы или мышц.
      </p>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-3.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase opacity-65">
        {icon}
        {label}
      </dt>
      <dd className="tabular mt-1.5 text-xl font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

function formatTonnage(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (value >= 10_000) return `${Math.round(value / 1000)} тыс.`;
  return `${Math.round(value).toLocaleString("ru")} кг`;
}
