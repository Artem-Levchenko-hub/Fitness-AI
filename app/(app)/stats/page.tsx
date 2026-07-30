import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";

import { BodyTrendChart, type BodyPoint } from "@/components/charts/BodyTrendChart";
import { FrequencyHeatmap } from "@/components/charts/FrequencyHeatmap";
import { MuscleVolumeBars } from "@/components/charts/MuscleVolumeChart";
import { MuscleVolumeSilhouette } from "@/components/charts/MuscleVolumeSilhouette";
import { OneRmTrendChart } from "@/components/charts/OneRmTrendChart";
import { VolumeBarChart } from "@/components/charts/VolumeChart";
import { StatsOverview } from "@/components/stats/StatsOverview";
import { WeeklyReviewButton } from "@/components/stats/WeeklyReviewButton";
import { buildExerciseLinkMap } from "@/lib/ai/exercise-links";
import { parseWeeklyReviewResult } from "@/lib/ai/weekly-review-display";
import { requireUser } from "@/lib/auth/require-user";
import { getLatestWeeklyReview } from "@/lib/repos/workouts.repo";
import {
  summarizeExerciseTrend,
  summarizeVolumeChange,
} from "@/lib/domain/stats/period-insight";
import { buildStatsOverview } from "@/lib/domain/stats/overview";
import { getUserProfile, listMeasurements } from "@/lib/repos/body.repo";
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

  // Календарные дни/недели графиков бакетятся в timezone юзера — РОВНО как
  // история `/workouts` (G1): graph и история показывают тренировку в один и
  // тот же день. Фолбэк Europe/Moscow = TZ сервера (как `/workouts`).
  const profile = await getUserProfile(user.id);
  const tz = profile?.timezone ?? "Europe/Moscow";

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
    weeklyReview,
  ] = await Promise.all([
    topLineKpi(user.id, range),
    granularity === "week"
      ? weeklyVolume(user.id, range, tz)
      : dailyVolume(user.id, range, tz),
    volumeByMuscle(user.id, range),
    repRangeDistribution(user.id, range),
    workoutFrequency(user.id, "365d", tz),
    trainedExercises(user.id),
    listMeasurements(user.id, 60),
    periodVolumeComparison(user.id, range),
    topMoverByE1rm(user.id, range),
    getLatestWeeklyReview(user.id),
  ]);

  // H8.2c — авто-сгенерированный недельный разбор (воркер H8.2). Валидируем
  // сохранённый resultJson перед рендером (fail-soft R-10: битый → не показываем).
  const weeklyAuto = weeklyReview
    ? parseWeeklyReviewResult(weeklyReview.resultJson)
    : null;
  const weeklyAutoAt =
    weeklyAuto && weeklyReview
      ? new Date(weeklyReview.createdAt).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
        })
      : null;

  // H11.1c/H13: source-agnostic карта «имя движения → exerciseId» из упражнений
  // атлета (nameRu; nameEn недоступен в trainedExercises — buildExerciseLinkMap
  // пропускает пустой ключ). Покрывает любое движение, названное в авто-разборе;
  // нет матча → строка остаётся статичной (fail-soft R-10).
  const weeklyExerciseLinks = buildExerciseLinkMap(
    exercises.map((e) => ({
      exerciseId: e.id,
      exerciseNameRu: e.nameRu,
      exerciseNameEn: "",
    })),
  );

  const periodInsight = summarizeVolumeChange(
    volumeCompare.current,
    volumeCompare.previous,
    range,
  );

  // Инсайт по ключевому движению (наибольший рост e1RM) — словами над графиком
  // 1RM. null при range='all' или когда нет упражнения с данными в обоих окнах.
  const strengthInsight = topMover
    ? summarizeExerciseTrend(
        {
          name: topMover.name,
          current: topMover.currentE1rm,
          previous: topMover.previousE1rm,
        },
        range,
      )
    : null;
  const overview = buildStatsOverview({
    workouts: kpi.workouts,
    totalSets: kpi.totalSets,
    totalReps: kpi.totalReps,
    strengthInsight,
  });

  const currentExId = sp.ex && exercises.some((e) => e.id === sp.ex)
    ? sp.ex
    : exercises[0]?.id;
  const oneRm = currentExId
    ? await oneRmTrend(user.id, currentExId, range, tz)
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

      <StatsOverview
        range={range}
        copy={overview}
        workouts={kpi.workouts}
        totalSets={kpi.totalSets}
        totalReps={kpi.totalReps}
        totalTonnageKg={kpi.totalTonnageKg}
        loadInsight={periodInsight}
      />

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
              Сила
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">
              Прогресс по упражнению
            </h2>
            <p className="text-muted-foreground mt-1 max-w-lg text-xs leading-relaxed">
              e1RM — оценка максимума по весу и повторам. Смотри на направление
              нескольких сопоставимых тренировок, а не на одну точку.
            </p>
          </div>
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
        <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
          Регулярность
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">
          Последние 18 недель
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs leading-relaxed">
          Каждая клетка — день. Чем темнее клетка, тем больше завершённых
          тренировок в этот день.
        </p>
        <FrequencyHeatmap data={frequency} weeks={18} />
      </section>

      <section className="bg-card border-border mt-6 rounded-2xl border p-5">
        <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
          Баланс
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">
          Куда пришлась внешняя нагрузка
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 text-xs leading-relaxed">
          Сравнивает вес × повторы по мышечным группам. Упражнения без
          указанного веса здесь недооценены, поэтому это карта внешнего
          отягощения, а не «эффективности» мышц.
        </p>
        <MuscleVolumeSilhouette data={muscle} />
        <MuscleVolumeBars data={muscle} />
      </section>

      {bodyTrend.length > 0 ? (
        <section className="bg-card border-border mt-6 rounded-2xl border p-5">
          <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
            Измерения
          </p>
          <h2 className="mt-1 mb-4 text-base font-semibold tracking-tight">
            Вес и процент жира
          </h2>
          <BodyTrendChart data={bodyTrend} />
        </section>
      ) : null}

      <details className="group bg-card border-border mt-6 rounded-2xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-none">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Подробные показатели
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Тоннаж по времени и распределение рабочих диапазонов.
            </p>
          </div>
          <ChevronDown
            className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="border-border space-y-8 border-t p-5">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">
                  Внешняя нагрузка по{" "}
                  {granularity === "week" ? "неделям" : "дням"}
                </h3>
                <p className="text-muted-foreground mt-1 max-w-lg text-xs leading-relaxed">
                  Вес × повторы. Больше не всегда лучше: резкий рост может быть
                  сменой программы или скачком нагрузки.
                </p>
              </div>
              <GranularityPills />
            </div>
            <VolumeBarChart data={volumeForChart} granularity={granularity} />
          </section>

          <section>
            <h3 className="text-sm font-semibold tracking-tight">
              Рабочие диапазоны повторений
            </h3>
            <p className="text-muted-foreground mt-1 mb-4 text-xs leading-relaxed">
              Какая доля выполненных подходов пришлась на каждый диапазон.
              Мини-подходы Myo-reps учитываются по фактическим повторам.
            </p>
            <ul className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {repBuckets.map((b) => {
                const pct = (b.sets / totalSetsByBucket) * 100;
                return (
                  <li key={b.bucket} className="bg-muted/45 rounded-xl p-3">
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
        </div>
      </details>

      <WeeklyReviewButton
        initial={weeklyAuto}
        initialAt={weeklyAutoAt}
        initialExerciseLinks={weeklyExerciseLinks}
      />
    </main>
  );
}
