import { TREND_LABEL, trendStatus, type TrendStatus } from "../progression/trend";
import { type StatsRange } from "./range";

/** Окно периода для /stats = доменный `StatsRange` (единый источник правды;
 *  раньше значения дублировались здесь). page/repo передают сюда тот же тип. */
export type InsightRange = StatsRange;

/** Человекочитаемый вывод о тренировочном объёме за период (G6): вместо
 *  абстрактных kg·повт — простая фраза «растёшь/стоишь/падаешь» со сравнением
 *  с прошлым окном той же длины. Чистый домен, без зависимостей от БД/UI. */
export type PeriodInsight = {
  status: TrendStatus;
  /** Короткий вердикт-заголовок («Ты растёшь»). */
  headline: string;
  /** Поясняющая фраза человеческим языком, без жаргона. */
  detail: string;
  /** Дельта в процентах (округлена). null когда сравнивать не с чем. */
  pct: number | null;
};

/** Подпись окна периода в винительном/родительном виде для фразы
 *  «за <window> … чем за прошлый <windowPrev>». */
const WINDOW_LABEL: Record<InsightRange, { cur: string; prev: string }> = {
  "7d": { cur: "неделю", prev: "неделю" },
  "30d": { cur: "месяц", prev: "месяц" },
  "90d": { cur: "3 месяца", prev: "3 месяца" },
  "365d": { cur: "год", prev: "год" },
  all: { cur: "всё время", prev: "всё время" },
};

/** Изменение объёма ниже этого порога (в долях) считаем «держишь уровень» —
 *  недельные колебания нагрузки нормальны, не каждый дрейф = тренд. */
const STAGNANT_PCT = 0.05;

/**
 * Формирует человекочитаемый вывод об изменении тренировочного объёма.
 * `previous == null` (range='all') или `previous == 0` (нет прошлого периода
 * с данными) → статус "new": сравнивать не с чем, без ложного «прогресса».
 */
export function summarizeVolumeChange(
  current: number,
  previous: number | null,
  range: InsightRange,
): PeriodInsight {
  const w = WINDOW_LABEL[range];

  // Нет базы для сравнения — ни прошлого окна, ни данных в нём.
  if (previous == null || previous <= 0) {
    return {
      status: "new",
      headline: "Пока копим данные",
      detail:
        "Не с чем сравнить — потренируйся ещё, и здесь появится понятный вывод о прогрессе.",
      pct: null,
    };
  }

  const status = trendStatus(previous, current, {
    higherIsBetter: true,
    epsilon: previous * STAGNANT_PCT,
  });
  const pct = Math.round(((current - previous) / previous) * 100);
  const absPct = Math.abs(pct);

  switch (status) {
    case "improved":
      return {
        status,
        headline: "Ты растёшь 💪",
        detail: `Объём тренировок за ${w.cur} на ${absPct}% больше, чем за прошлый ${w.prev}. Так держать!`,
        pct,
      };
    case "regressed":
      return {
        status,
        headline: "Объём снизился",
        detail: `За ${w.cur} ты сделал на ${absPct}% меньше, чем за прошлый ${w.prev}. Это нормально для разгрузки — но если не планировал отдых, стоит добавить нагрузку.`,
        pct,
      };
    default:
      return {
        status: "stagnant",
        headline: "Держишь уровень",
        detail: `Объём тренировок примерно как за прошлый ${w.prev}. Чтобы расти — добавь вес или повторения.`,
        pct,
      };
  }
}

/** Изменение оценочного 1RM ниже этого порога (в долях) считаем «держится» —
 *  e1RM шумит от подхода к подходу, не каждый дрейф = тренд. */
const E1RM_STAGNANT_PCT = 0.05;

/** Прирост e1RM выше этого за одно окно физиологически маловероятен — скорее
 *  опечатка в весе (G5). Не скрываем рост, но честно оговариваем. */
const IMPLAUSIBLE_GAIN_PCT = 50;

export type ExerciseTrendInput = {
  /** Имя движения (нормализованное, как в каталоге упражнений). */
  name: string;
  /** Лучший e1RM (кг) за текущее окно периода. */
  current: number;
  /** Лучший e1RM (кг) за предыдущее окно той же длины. */
  previous: number;
};

/**
 * Человекочитаемый вывод о тренде ОДНОГО движения (G6): вместо абстрактного
 * 1RM-графика — фраза «жим растёт на X%, 80 → 85 кг». Чистый домен (R-7).
 * `previous <= 0` → "new" (нет базы для сравнения).
 */
export function summarizeExerciseTrend(
  input: ExerciseTrendInput,
  range: InsightRange,
): PeriodInsight {
  const { name, current, previous } = input;
  const w = WINDOW_LABEL[range];

  if (previous <= 0) {
    return {
      status: "new",
      headline: `${name}: пока копим данные`,
      detail: "Недостаточно истории для сравнения по этому движению.",
      pct: null,
    };
  }

  const status = trendStatus(previous, current, {
    higherIsBetter: true,
    epsilon: previous * E1RM_STAGNANT_PCT,
  });
  const pct = Math.round(((current - previous) / previous) * 100);
  const absPct = Math.abs(pct);
  const curKg = Math.round(current);
  const prevKg = Math.round(previous);

  switch (status) {
    case "improved": {
      const caution =
        pct > IMPLAUSIBLE_GAIN_PCT
          ? " Это очень резкий скачок — проверь, не закралась ли опечатка в вес."
          : "";
      return {
        status,
        headline: `${name} растёт 💪`,
        detail: `Оценочный максимум за ${w.cur} вырос на ${absPct}% — ${prevKg} → ${curKg} кг.${caution}`,
        pct,
      };
    }
    case "regressed":
      return {
        status,
        headline: `${name}: просадка`,
        detail: `Оценочный максимум за ${w.cur} снизился на ${absPct}% — ${prevKg} → ${curKg} кг. Бывает после тяжёлой недели или недосыпа.`,
        pct,
      };
    default:
      return {
        status: "stagnant",
        headline: `${name}: держится`,
        detail: `Оценочный максимум примерно как в прошлый ${w.prev} (~${curKg} кг). Чтобы сдвинуть — добавь вес или повтор.`,
        pct,
      };
  }
}

/** Короткая подпись статуса (бейдж) — переиспользует общий словарь трендов. */
export function periodInsightBadge(status: TrendStatus): string {
  return TREND_LABEL[status];
}
