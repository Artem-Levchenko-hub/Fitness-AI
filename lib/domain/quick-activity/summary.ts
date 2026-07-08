/** Сводка дня доп. активности для тайла/шита: группировка записей по
 *  упражнению в компактные строки. Чистый модуль (R-7): без db/React.
 *
 *  Формат detail:
 *  - подходы (mode='sets') — повторы в хронологии через «+»: «12+10+8»;
 *  - тотал — одно число суммой: «100»;
 *  - смешанное (редко) — общий хронологический список через «+».
 */

export type QuickDayEntry = {
  exerciseName: string;
  mode: "sets" | "total";
  reps: number;
};

export type QuickDaySummary = {
  exerciseName: string;
  /** «12+10+8» или «100» — уже готовая строка для UI. */
  detail: string;
  totalReps: number;
  entries: number;
};

/** Вход — записи в порядке УБЫВАНИЯ свежести (как отдаёт repo).
 *  Выход — группы по упражнению, свежайшая группа первой; внутри группы
 *  повторы разворачиваются в хронологический порядок. */
export function summarizeQuickDay(entries: QuickDayEntry[]): QuickDaySummary[] {
  const groups = new Map<string, QuickDayEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.exerciseName) ?? [];
    list.push(e);
    groups.set(e.exerciseName, list);
  }

  const out: QuickDaySummary[] = [];
  for (const [exerciseName, list] of groups) {
    const chrono = [...list].reverse();
    const totalReps = chrono.reduce((s, e) => s + e.reps, 0);
    const isSingleTotal = chrono.length === 1 && chrono[0]!.mode === "total";
    const detail = isSingleTotal
      ? String(totalReps)
      : chrono.map((e) => e.reps).join("+");
    out.push({ exerciseName, detail, totalReps, entries: chrono.length });
  }
  return out;
}
