import { muscleLabelRu } from "../domain/avatar/heat";
import type { PastAdvice } from "./trainer-memory";

/** Агрегаты одной недели (силовые completed-сессии). Тоннаж = вес×повт
 *  working-подходов; muscleVolumes — role-взвешенный тоннаж по группам
 *  (primary 1.0 / secondary 0.5), как на /stats. */
export type WeekAgg = {
  sessions: number;
  tonnage: number;
  sets: number;
  muscleVolumes: { muscleKey: string; volume: number }[];
};

/** Одна ночь сна за разбираемую неделю. */
export type WeeklySleepRow = {
  date: string;
  hours: number;
  quality: number | null;
};

/** Один день питания за разбираемую неделю (для недельного жанра важны ккал
 *  и белок — фат/углеводы оставляем дневному дайджесту, YAGNI). */
export type WeeklyNutritionRow = {
  date: string;
  kcal: number | null;
  proteinG: number | null;
};

/** Одно «ключевое движение недели» (H11.1c): лучший рабочий сет упражнения за
 *  эту ISO-неделю против его лучшего за всю историю ДО неё. Источник для блока
 *  «# Ключевые движения недели» и — через него — для exerciseComparisons
 *  недельного разбора (тренер называет движения, а не только тоннаж). */
export type WeeklyKeyMovement = {
  exerciseId: string;
  nameRu: string;
  nameEn: string;
  /** Лучший рабочий сет (по e1RM) этой недели. */
  curTopSet: { weightKg: number; reps: number };
  /** Лучший рабочий сет ДО этой недели (null = первый раз = новое движение). */
  prevTopSet: { weightKg: number; reps: number } | null;
  curE1rm: number;
  /** Лучший e1RM за всю историю ДО недели (null = новое движение). */
  prevE1rm: number | null;
  /** curE1rm − prevE1rm (null для нового движения — сравнивать не с чем). */
  deltaE1rm: number | null;
  /** Недельный PR: e1RM этой недели побил личный рекорд до неё. */
  isPr: boolean;
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
  /** Ночи сна за разбираемую (текущую) ISO-неделю — тренер оценивает по ним
   *  восстановление; пусто → честный null + missingDataAdvice (H11.1). */
  sleep: WeeklySleepRow[];
  /** Дни питания за разбираемую ISO-неделю — тренер оценивает по ним КБЖУ. */
  nutrition: WeeklyNutritionRow[];
  /** Топ движений недели по |Δe1RM| (уже отобраны репо, до 3). Пусто → неделя
   *  без силовых данных по упражнениям → блок опущен, exerciseComparisons=[]. */
  keyMovements: WeeklyKeyMovement[];
};

/** Сколько движений показать в блоке «ключевые движения недели». */
const MAX_KEY_MOVEMENTS = 3;

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

function signed(n: number): string {
  const v = Number(n.toFixed(1));
  return v >= 0 ? `+${v}` : `${v}`;
}

/** Отбор топ-движений недели: по убыванию |Δe1RM|. Новые движения (нет дельты)
 *  тонут ниже движений с реальным сравнением, но попадают в хвост, если мест в
 *  тройке хватает. Тай-брейк — больший e1RM, затем стабильный id. Чистая (R-7),
 *  юнит-тестируема; репо отдаёт уже отобранный список. */
export function selectKeyMovements(
  candidates: WeeklyKeyMovement[],
): WeeklyKeyMovement[] {
  const rank = (m: WeeklyKeyMovement) =>
    m.deltaE1rm == null ? -Infinity : Math.abs(m.deltaE1rm);
  return [...candidates]
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        b.curE1rm - a.curE1rm ||
        a.exerciseId.localeCompare(b.exerciseId),
    )
    .slice(0, MAX_KEY_MOVEMENTS);
}

function topSetStr(s: { weightKg: number; reps: number }): string {
  return `${s.weightKg}×${s.reps}`;
}

/** Markdown-блок «ключевые движения недели» для промпта тренера. Каждое
 *  движение = прошлый→текущий топ-сет + дельта e1RM (или пометка «новое»);
 *  недельный PR помечается трофеем. Пусто → "" (блок опущен, R-37: тренер не
 *  выдумывает движений). Чистая функция — числа даёт репо. */
export function formatWeeklyMovementsBlock(
  movements: WeeklyKeyMovement[],
): string {
  if (movements.length === 0) return "";
  const lines = ["# Ключевые движения недели", ""];
  for (const m of movements) {
    if (m.prevTopSet && m.prevE1rm != null && m.deltaE1rm != null) {
      const pr = m.isPr ? " 🏆 PR недели" : "";
      lines.push(
        `- ${m.nameRu}: ${topSetStr(m.prevTopSet)} → ${topSetStr(m.curTopSet)} ` +
          `(e1RM ${m.prevE1rm.toFixed(1)}→${m.curE1rm.toFixed(1)} кг, ${signed(m.deltaE1rm)})${pr}`,
      );
    } else {
      lines.push(
        `- ${m.nameRu}: новое движение, ${topSetStr(m.curTopSet)} (e1RM ${m.curE1rm.toFixed(1)} кг)`,
      );
    }
  }
  return lines.join("\n");
}

/** Markdown-блок «итог недели» для промпта тренера: эта неделя vs прошлая по
 *  объёму, сессиям, группам мышц + заметка недели. Чистая функция — числа
 *  даёт репо, тон задаёт WEEKLY_SYSTEM_PROMPT. */
export function formatWeeklyReviewBlock(
  data: WeeklyReviewInput,
  memory = "",
): string {
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

  const movementsBlock = formatWeeklyMovementsBlock(data.keyMovements);
  if (movementsBlock) {
    lines.push("", movementsBlock);
  }

  if (cycleNote && cycleNote.trim()) {
    lines.push("", "## Заметка недели атлета", cycleNote.trim());
  }

  lines.push("", formatWeeklySleepBlock(data.sleep));
  lines.push("", formatWeeklyNutritionBlock(data.nutrition));

  if (memory.trim()) {
    lines.push("", memory.trim());
  }

  return lines.join("\n");
}

/** H11.1b «Память недельного тренера»: прошлый недельный фокус → блок контекста,
 *  замыкающий цикл «предписал → проверил». Жанр-специфичен (формулировка про
 *  НЕДЕЛЮ, не про сессию), поэтому живёт здесь, а не в trainer-memory.ts; парс
 *  resultJson переиспользует чистый `extractPastAdvice` (R-04). Чистая (R-7),
 *  formatDate инжектируется (детерминизм теста без ICU).
 *
 *  Нет предшественника (null) или legacy-разбор без focus → "" (блок опущен,
 *  R-37: не выдумывать прошлый фокос, которого нет). Иначе цитирует фокус и
 *  требует заполнить pastAdviceFollowUp с вердиктом по цифрам недели. */
export function formatWeeklyMemoryBlock(
  advice: PastAdvice | null,
  formatDate: (d: Date) => string,
): string {
  if (!advice || !advice.focus) return "";
  const score = advice.score != null ? ` (оценка ${advice.score}/100)` : "";
  return [
    "# Память тренера (твой прошлый недельный фокус)",
    "",
    `В прошлый раз (недельный разбор от ${formatDate(advice.createdAt)})${score} ты ставил фокус недели: «${advice.focus}».`,
    "",
    "ОБЯЗАТЕЛЬНО заполни поле pastAdviceFollowUp: начни с «На прошлой неделе я ставил фокус: …», затем оцени — выполнен он или нет — цифрами ЭТОЙ недели (тоннаж / число сессий / нагрузка на нужную группу).",
  ].join("\n");
}

/** Блок сна за разбираемую неделю. Есть ночи → среднее + по-ночам; пусто →
 *  явная пометка «нет записей» (тренер обязан вернуть recoveryContext.score
 *  null, не выдумывать — H11.1). */
function formatWeeklySleepBlock(rows: WeeklySleepRow[]): string {
  if (rows.length === 0) {
    return "# Сон за неделю\n_(нет записей за эту неделю)_";
  }
  const avg = rows.reduce((s, r) => s + r.hours, 0) / rows.length;
  const lines = rows.map(
    (r) =>
      `- ${r.date}: ${r.hours} ч${r.quality != null ? ` · качество ${r.quality}/5` : ""}`,
  );
  return `# Сон за неделю (${rows.length} ноч., среднее ${avg.toFixed(1)} ч)\n\n${lines.join("\n")}`;
}

/** Блок питания за разбираемую неделю. Есть дни → по-дням ккал/белок; пусто →
 *  явная пометка «нет записей» (тренер обязан вернуть nutritionContext.score
 *  null). */
function formatWeeklyNutritionBlock(rows: WeeklyNutritionRow[]): string {
  if (rows.length === 0) {
    return "# Питание за неделю\n_(нет записей за эту неделю)_";
  }
  const lines = rows.map((r) => {
    const macro = [
      r.kcal != null ? `${r.kcal} ккал` : null,
      r.proteinG != null ? `Б ${r.proteinG}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `- ${r.date}: ${macro || "(без макро)"}`;
  });
  return `# Питание за неделю (${rows.length} дн.)\n\n${lines.join("\n")}`;
}
