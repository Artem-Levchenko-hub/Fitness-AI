import type { Metadata } from "next";

import { BodyTrendChart, type BodyPoint } from "@/components/charts/BodyTrendChart";
import { FrequencyHeatmap } from "@/components/charts/FrequencyHeatmap";
import { MuscleVolumeBars } from "@/components/charts/MuscleVolumeChart";
import { OneRmTrendChart } from "@/components/charts/OneRmTrendChart";
import { VolumeBarChart } from "@/components/charts/VolumeChart";
import { PeriodInsightCard } from "@/components/stats/PeriodInsightCard";
import { requireUser } from "@/lib/auth/require-user";
import {
  summarizeExerciseTrend,
  summarizeVolumeChange,
} from "@/lib/domain/stats/period-insight";
import { listMeasurements } from "@/lib/repos/body.repo";
import {
  dailyVolume,
  oneRmTrend,
  periodVolumeComparison,
  rangeToFromDate,
  repRangeDistribution,
  topMoverByE1rm,
  trainedExercises,
  topLineKpi,
  volumeByMuscle,
  weeklyVolume,
  workoutFrequency,
  type StatsRange,
} from "@/lib/repos/stats.repo";

import {
  ExerciseSelector,
  GranularityPills,
  PeriodPills,
} from "./stats-controls";

export const metadata: Metadata = { title: "Статистика" };

const ALLOWED_RANGES: StatsRange[] = ["7d", "30d", "90d", "365d", "all"];

type Props = {
  searchParams: Promise<{ range?: string; g?: string; ex?: string }>;
};

export default async function StatsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await requireUser();

  const range: StatsRange = ALLOWED_RANGES.includes(sp.range as StatsRange)
    ? (sp.range as StatsRange)
    : "30d";
  const granularity: "day" | "week" = sp.g === "week" ? "week" : "day";

  const [
    kpi,
    volume,
    muscle,
    repBuckets,
    frequency,
    exercises,
    measurements,
    volumeCompare,
    topMover,
  ] = await Promise.all([
    topLineKpi(user.id, range),
    granularity === "week"
      ? weeklyVolume(user.id, range)
      : dailyVolume(user.id, range),
    volumeByMuscle(user.id, range),
    repRangeDistribution(user.id, range),
    workoutFrequency(user.id, "365d"),
    trainedExercises(user.id),
    listMeasurements(user.id, 60),
    periodVolumeComparison(user.id, range),
    topMoverByE1rm(user.id, range),
  ]);

  const periodInsight = summarizeVolumeChange(
    volumeCompare.current,
    volumeCompare.previous,
    range,
  );

  // Инсайт по ключевому движению (наибольший рост e1RM) — словами над графиком
  // 1RM. null при range='all' или когда нет упражнения с данными в обоих окнах.
  const moverInsight = topMover
    ? summarizeExerciseTrend(
        {
          name: topMover.name,
          current: topMover.currentE1rm,
          previous: topMover.previousE1rm,
        },
        range,
      )
    : null;

  const currentExId = sp.ex && exercises.some((e) => e.id === sp.ex)
    ? sp.ex
    : exercises[0]?.id;
  const oneRm = currentExId
    ? await oneRmTrend(user.id, currentExId, range)
    : [];

  const totalSetsByBucket = repBuckets.reduce((s, b) => s + b.sets, 0) || 1;
  const fromHint = rangeToFromDate(range);

  // Body trend для графика — берём измерения за период
  const bodyTrend: BodyPoint[] = measurements
    .filter(
      (m) =>
        !fromHint || new Date(m.measuredAt).getTime() >= fromHint.getTime(),
    )
    .map((m) => ({
      date: new Date(m.measuredAt).toISOString().slice(0, 10),
      weightKg: m.weightKg ?? null,
      bodyFatPct: m.bodyFatPct ?? null,
    }))
    .reverse();

  const volumeForChart = volume.map((v) => ({
    date: granularity === "week" && "weekStart" in v ? v.weekStart : (v as { date: string }).date,
    volume: v.volume,
    sets: v.sets,
    reps: v.reps,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Аналитика
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Статистика
        </h1>
      </header>

      <PeriodPills />

      <PeriodInsightCard insight={periodInsight} />

      {moverInsight ? (
        <PeriodInsightCard insight={moverInsight} eyebrow="Ключевое движение" />
      ) : null}

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Тренировок"
          value={kpi.workouts.toLocaleString("ru")}
        />
        <Kpi
          label="Подходов"
          value={kpi.totalSets.toLocaleString("ru")}
        />
        <Kpi
          label="Повторений"
          value={kpi.totalReps.toLocaleString("ru")}
        />
        <Kpi
          label="Тоннаж"
          value={`${Math.round(kpi.totalTonnageKg).toLocaleString("ru")} кг·повт`}
          big={false}
        />
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Объём по {granularity === "week" ? "неделям" : "дням"}
          </h2>
          <GranularityPills />
        </div>
        <VolumeBarChart data={volumeForChart} granularity={granularity} />
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            1RM (оценочный)
          </h2>
          {currentExId ? (
            <ExerciseSelector
              exercises={exercises}
              current={currentExId}
            />
          ) : null}
        </div>
        <OneRmTrendChart data={oneRm} />
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Объём по группам мышц
        </h2>
        <MuscleVolumeBars data={muscle} />
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Распределение по диапазону повторений
        </h2>
        <ul className="grid grid-cols-4 gap-3 text-center">
          {repBuckets.map((b) => {
            const pct = (b.sets / totalSetsByBucket) * 100;
            return (
              <li key={b.bucket}>
                <p className="font-serif tabular text-2xl font-normal">
                  {pct.toFixed(0)}%
                </p>
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  {b.bucket} повт
                </p>
                <p className="text-muted-foreground/70 tabular text-xs">
                  {b.sets} подх.
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Активность за {frequency.length > 0 ? "год" : "период"}
        </h2>
        <FrequencyHeatmap data={frequency} weeks={18} />
      </section>

      <section className="bg-card border-border mt-6 mb-2 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Вес и % жира
        </h2>
        <BodyTrendChart data={bodyTrend} />
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  big = true,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={`tabular mt-1 font-semibold tracking-tight ${big ? "text-2xl" : "text-base"}`}
      >
        {value}
      </p>
    </div>
  );
}
