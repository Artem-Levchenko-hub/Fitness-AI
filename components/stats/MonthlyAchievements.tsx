import {
  Check,
  Dumbbell,
  Gauge,
  Medal,
  Repeat2,
  Scale,
  Target,
  Trophy,
} from "lucide-react";

import {
  type AchievementTrack,
  buildAchievementTracks,
  countAchievementLevels,
  countUnlockedAchievements,
  type MonthlySummary,
} from "@/lib/domain/stats/achievements";
import type { AchievementFacts } from "@/lib/domain/stats/achievements";

export function MonthlyAchievements({
  monthly,
  facts,
}: {
  monthly: MonthlySummary;
  facts: AchievementFacts;
}) {
  const tracks = buildAchievementTracks(facts);
  const unlocked = countUnlockedAchievements(tracks);
  const totalLevels = countAchievementLevels(tracks);
  const hasMonthlyActivity =
    monthly.workouts > 0 || monthly.totalSets > 0 || monthly.totalReps > 0;
  const isTonnageTrack = (key: AchievementTrack["key"]) =>
    key === "maxWorkoutTonnageT" || key === "totalTonnageT";

  return (
    <>
      <section className="bg-card border-border mt-5 overflow-hidden rounded-3xl border">
        <div className="border-border flex items-start gap-3 border-b px-5 py-4 md:px-6">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-2xl">
            <Target className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
              Итоги месяца
            </p>
            <h2 className="mt-1 text-lg font-semibold capitalize">
              {monthly.month.label}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {hasMonthlyActivity
                ? `За месяц: ${formatInteger(monthly.workouts)} ${plural(monthly.workouts, "тренировка", "тренировки", "тренировок")}, ${formatInteger(monthly.weightedSquatReps)} ${plural(monthly.weightedSquatReps, "приседание", "приседания", "приседаний")} с весом и ${formatInteger(monthly.pullUpReps)} ${plural(monthly.pullUpReps, "подтягивание", "подтягивания", "подтягиваний")}.`
                : "Пока нет записанной активности. Итоги появятся после завершения тренировки или записи дополнительной активности."}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          <MonthMetric label="Тренировки" value={formatInteger(monthly.workouts)} />
          <MonthMetric label="Подходы / раунды" value={formatInteger(monthly.totalSets)} />
          <MonthMetric label="Все повторы" value={formatInteger(monthly.totalReps)} />
          <MonthMetric label="Внешняя нагрузка" value={formatTonnage(monthly.totalTonnageKg)} />
          <MonthMetric label="Подтягивания" value={formatInteger(monthly.pullUpReps)} />
          <MonthMetric label="Присед с весом" value={formatInteger(monthly.weightedSquatReps)} />
        </dl>

        <p className="text-muted-foreground bg-card px-5 py-3 text-[11px] leading-relaxed md:px-6">
          Сессии — завершённые силовые, круговые и кардио. Дополнительная
          активность входит в подходы и повторы, но не считается отдельной
          тренировкой.
        </p>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">
              Достижения
            </p>
            <h2 className="mt-1 text-lg font-semibold">Личные рубежи</h2>
          </div>
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1.5 text-xs font-semibold">
            {unlocked} из {totalLevels}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {tracks.map((track) => (
            <article
              key={track.key}
              className={`bg-card border-border rounded-2xl border p-4 ${isTonnageTrack(track.key) ? "md:col-span-2" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  {isTonnageTrack(track.key) ? (
                    <Scale className="size-5" aria-hidden />
                  ) : track.key === "workouts" ? (
                    <Trophy className="size-5" aria-hidden />
                  ) : track.key === "pullUpReps" ? (
                    <Repeat2 className="size-5" aria-hidden />
                  ) : (
                    <Dumbbell className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{track.title}</h3>
                      <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                        {track.description}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-right text-lg font-semibold">
                      {formatAchievementCurrent(track)}
                      <span className="text-muted-foreground ml-1 text-[10px] font-medium">
                        {track.unit}
                      </span>
                    </span>
                  </div>

                  <div
                    className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={`Прогресс: ${track.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={track.progressPct}
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-[width]"
                      style={{ width: `${track.progressPct}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {track.levels.map((level) => {
                      const earned = track.current >= level;
                      return (
                        <span
                          key={level}
                          className={
                            earned
                              ? "bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
                              : "bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
                          }
                        >
                          {earned ? (
                            <Check className="size-3" aria-hidden />
                          ) : (
                            <Medal className="size-3" aria-hidden />
                          )}
                          <span>
                            {track.levelLabels?.[level] ? (
                              <span className="mr-1">
                                {track.levelLabels[level]}
                              </span>
                            ) : null}
                            {formatNumber(level)} {track.unit}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11px]">
                    <Gauge className="size-3.5" aria-hidden />
                    {track.nextTarget
                      ? `Следующий рубеж: ${track.levelLabels?.[track.nextTarget] ? `${track.levelLabels[track.nextTarget]} · ` : ""}${formatNumber(track.nextTarget)} ${track.unit}`
                      : "Все рубежи открыты"}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
          Тоннаж — сумма внешней нагрузки в завершённых рабочих подходах;
          разминки и пропущенные круги не входят. Дополнительная активность
          входит только в общий тоннаж. Весовые рубежи жима и приседа учитывают
          лучший рабочий подход или контрольный тест из «Рекордов».
        </p>
      </section>
    </>
  );
}

function MonthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card min-w-0 px-4 py-4 md:px-5">
      <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="tabular mt-1 text-xl font-semibold tracking-tight">
        {value}
      </dd>
    </div>
  );
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("ru-RU")
    : value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

function formatAchievementCurrent(track: AchievementTrack): string {
  if (
    track.key !== "maxWorkoutTonnageT" &&
    track.key !== "totalTonnageT"
  ) {
    return formatNumber(track.current);
  }

  return formatTonnageAchievementValue(track.current);
}

export function formatTonnageAchievementValue(value: number): string {
  const truncated = Math.floor(Math.max(0, value) * 100 + 1e-9) / 100;
  return truncated.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatTonnage(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн кг`;
  }
  if (value >= 10_000) return `${Math.round(value / 1_000).toLocaleString("ru-RU")} тыс. кг`;
  return `${Math.round(value).toLocaleString("ru-RU")} кг`;
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(Math.round(value)) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
