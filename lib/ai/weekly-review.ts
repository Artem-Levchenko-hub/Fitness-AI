import { muscleLabelRu } from "../domain/avatar/heat";

/** Агрегаты одной недели (силовые completed-сессии). Тоннаж = вес×повт
 *  working-подходов; muscleVolumes — role-взвешенный тоннаж по группам
 *  (primary 1.0 / secondary 0.5), как на /stats. */
export type WeekAgg = {
  sessions: number;
  tonnage: number;
  sets: number;
  muscleVolumes: { muscleKey: string; volume: number }[];
};

/** Вход чистого форматтера недельного разбора — НАМЕРЕННО развязан с репо
 *  (R-7: модуль без db/env, юнит-тестируем). Репо `weeklyReviewData` отдаёт
 *  ровно эту форму. */
export type WeeklyReviewInput = {
  /** Понедельник текущей ISO-недели "YYYY-MM-DD". */
  weekStart: string;
  /** Понедельник прошлой ISO-недели "YYYY-MM-DD". */
  prevWeekStart: string;
  current: WeekAgg;
  previous: WeekAgg;
  /** CycleNote недели (markdown) — «второй мозг» атлета, целиком. */
  cycleNote: string | null;
};

/** Есть ли что разбирать: хотя бы одна силовая сессия на этой ИЛИ прошлой
 *  неделе. Единый источник правила «разбор недели имеет смысл» — и для
 *  кнопки «по запросу» (H8.1), и для авто-воркера (H8.2). Пустые обе недели →
 *  не жжём LLM. Чистая (R-7), юнит-тестируема. */
export function hasWeeklyData(data: WeeklyReviewInput): boolean {
  return data.current.sessions > 0 || data.previous.sessions > 0;
}

/** Сколько групп показать в блоке (бюджет промпта — самые нагруженные). */
const MAX_MUSCLE_ROWS = 8;

function round(n: number): number {
  return Math.round(n);
}

/** Дельта в % текущего к прошлому; null если базы нет (деление на 0 → не
 *  печатаем «−100%»/NaN). */
function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function signedPct(pct: number): string {
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** Markdown-блок «итог недели» для промпта тренера: эта неделя vs прошлая по
 *  объёму, сессиям, группам мышц + заметка недели. Чистая функция — числа
 *  даёт репо, тон задаёт WEEKLY_SYSTEM_PROMPT. */
export function formatWeeklyReviewBlock(data: WeeklyReviewInput): string {
  const { current, previous, cycleNote } = data;
  const lines: string[] = [
    `# Итог недели (ISO-неделя с ${data.weekStart}; прошлая — с ${data.prevWeekStart})`,
    "",
    "## Объём",
  ];

  if (current.sessions === 0) {
    lines.push(
      `Силовых сессий на этой неделе: 0 (прошлая неделя: ${previous.sessions}). Возможно, это разгрузка или отдых.`,
    );
  } else {
    lines.push(
      `Силовых сессий: ${current.sessions} (прошлая неделя: ${previous.sessions}).`,
    );
  }

  const tPct = deltaPct(current.tonnage, previous.tonnage);
  const tonnageLine =
    tPct === null
      ? `Тоннаж: ${round(current.tonnage)} кг·повт (прошлая неделя: ${
          previous.tonnage > 0
            ? `${round(previous.tonnage)} кг·повт`
            : "нет данных для сравнения"
        }).`
      : `Тоннаж: ${round(current.tonnage)} кг·повт vs ${round(
          previous.tonnage,
        )} кг·повт неделей раньше (${signedPct(tPct)}).`;
  lines.push(tonnageLine);
  lines.push(`Рабочих подходов: ${current.sets} (прошлая: ${previous.sets}).`);

  // Группы мышц: эта неделя vs прошлая. Объединяем ключи обеих недель, чтобы
  // показать и просевшие до нуля группы.
  const prevByKey = new Map(
    previous.muscleVolumes.map((m) => [m.muscleKey, m.volume]),
  );
  const curByKey = new Map(
    current.muscleVolumes.map((m) => [m.muscleKey, m.volume]),
  );
  const allKeys = new Set<string>([...curByKey.keys(), ...prevByKey.keys()]);
  const rows = Array.from(allKeys)
    .map((key) => ({
      key,
      cur: curByKey.get(key) ?? 0,
      prev: prevByKey.get(key) ?? 0,
    }))
    .sort((a, b) => b.cur - a.cur || b.prev - a.prev)
    .slice(0, MAX_MUSCLE_ROWS);

  if (rows.length > 0) {
    lines.push("", "## По группам мышц (тоннаж: эта неделя ← прошлая)");
    for (const r of rows) {
      lines.push(
        `- ${muscleLabelRu(r.key)}: ${round(r.cur)} ← ${round(r.prev)} кг·повт`,
      );
    }
  }

  if (cycleNote && cycleNote.trim()) {
    lines.push("", "## Заметка недели атлета", cycleNote.trim());
  }

  return lines.join("\n");
}
