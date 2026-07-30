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
  /** Короткий вердикт-заголовок. */
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

/** Изменение объёма ниже этого порога считаем стабильной нагрузкой —
 *  недельные колебания нормальны, не каждый дрейф = значимое изменение. */
const STAGNANT_PCT = 0.05;

/**
 * Формирует человекочитаемый вывод об изменении внешней нагрузки.
 * `previous == null` (range='all') или `previous == 0` (нет прошлого периода
 * с данными) → статус "new": сравнивать не с чем.
 *
 * Тоннаж не является самостоятельной оценкой прогресса: рост может означать
 * прогрессию, смену программы или скачок нагрузки, а снижение — разгрузку.
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
      headline: "Сравнение нагрузки пока недоступно",
      detail:
        "Нет предыдущего сопоставимого периода. Текущий тоннаж показан как исходная точка, а не как оценка прогресса.",
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
        headline: "Внешняя нагрузка выросла",
        detail: `Тоннаж за ${w.cur} на ${absPct}% выше, чем за прошлый ${w.prev}. Это изменение нагрузки — оценивай его вместе с силой, RPE и восстановлением.`,
        pct,
      };
    case "regressed":
      return {
        status,
        headline: "Внешняя нагрузка снизилась",
        detail: `Тоннаж за ${w.cur} на ${absPct}% ниже, чем за прошлый ${w.prev}. Это может быть плановой разгрузкой, изменением упражнений или меньшим числом сессий.`,
        pct,
      };
    default:
      return {
        status: "stagnant",
        headline: "Внешняя нагрузка стабильна",
        detail: `Тоннаж примерно как за прошлый ${w.prev}. Вывод о прогрессе лучше делать по сопоставимым упражнениям, технике и усилию.`,
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
        headline: `${name}: сила растёт`,
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
