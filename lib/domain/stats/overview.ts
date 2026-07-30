import type { PeriodInsight } from "./period-insight";

export type StatsOverviewInput = {
  workouts: number;
  totalSets: number;
  totalReps: number;
  strengthInsight: PeriodInsight | null;
};

export type StatsOverviewCopy = {
  headline: string;
  detail: string;
  nextStep: string;
};

export function buildStatsOverview(
  input: StatsOverviewInput,
): StatsOverviewCopy {
  if (input.workouts === 0) {
    return {
      headline: "Пока недостаточно данных",
      detail:
        "Заверши тренировку и запиши фактические подходы — после этого здесь появятся сравнимые тенденции.",
      nextStep: "Первая цель — получить две сопоставимые сессии одного упражнения.",
    };
  }

  const activity = `${input.workouts} ${plural(
    input.workouts,
    "тренировка",
    "тренировки",
    "тренировок",
  )}, ${input.totalSets} ${plural(
    input.totalSets,
    "подход или раунд",
    "подхода или раунда",
    "подходов или раундов",
  )} и ${input.totalReps} ${plural(
    input.totalReps,
    "повтор",
    "повтора",
    "повторов",
  )} за выбранный период.`;

  if (!input.strengthInsight) {
    return {
      headline: `${input.workouts} ${plural(
        input.workouts,
        "завершённая тренировка",
        "завершённые тренировки",
        "завершённых тренировок",
      )}`,
      detail: activity,
      nextStep:
        "Сравнение силы появится, когда одно упражнение будет выполнено и в текущем, и в предыдущем периоде.",
    };
  }

  switch (input.strengthInsight.status) {
    case "improved":
      return {
        headline: input.strengthInsight.headline,
        detail: input.strengthInsight.detail,
        nextStep:
          "Сохраняй сопоставимую технику и следи, чтобы рост не сопровождался резким ухудшением RPE или восстановления.",
      };
    case "regressed":
      return {
        headline: input.strengthInsight.headline,
        detail: input.strengthInsight.detail,
        nextStep:
          "Не делай вывод по одной точке: проверь сон, RPE и ещё одну сопоставимую сессию перед изменением программы.",
      };
    default:
      return {
        headline: input.strengthInsight.headline,
        detail: input.strengthInsight.detail,
        nextStep:
          "Ориентир на следующую сессию — сохранить технику и добавлять нагрузку только при уверенном запасе.",
      };
  }
}

function plural(
  value: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(value) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
