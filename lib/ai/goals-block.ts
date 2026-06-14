/** H18.3 — блок «# Цель» для per-workout контекста тренера: третья нога H18
 *  («цель → проекция темпа → milestone»). Тренер не только ВИДИТ цель, но и
 *  ВЕДЁТ к следующей (столп 1). Чистый модуль — нет импортов db/ai/env (R-07):
 *  готовые GoalProgressView (H18.2-A summarizeGoalProgress, R-04 не
 *  пересчитываем) приходят снаружи, формат-логика юнит-тестируема без сети.
 *  Зеркало flags.ts. Пусто → null (R-37: ноль фантомных блоков). */

import type { GoalProgressView } from "@/lib/domain/progression/goal-projection";

/** Цель упражнения сегодняшней сессии (kind weight|1rm — частота крепится к
 *  группе мышц, см. muscleGoals). */
export type ExerciseGoalLine = {
  nameRu: string;
  kind: "weight" | "1rm";
  view: GoalProgressView;
};

/** Цель частоты группы мышц, тренированной сегодня (подходов/нед). */
export type MuscleGoalLine = {
  label: string;
  view: GoalProgressView;
};

/** Число в человекочитаемое: целое без хвоста, дробное — с одним знаком (вес/1ПМ
 *  — double precision, например e1RM 91.7). */
function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Доля прогресса в проценты (целые). */
function fmtPct(view: GoalProgressView): string {
  return `${Math.round(view.pct * 100)}%`;
}

/** ETA в недели вслух: округление вверх до целого, минимум 1 (доли недели не
 *  показываем как «0 недель»). */
function fmtEta(etaWeeks: number): string {
  return String(Math.max(1, Math.round(etaWeeks)));
}

/** Хвост строки про темп к цели, общий для обоих видов целей. */
function paceTail(view: GoalProgressView, stagnantSuffix: string): string {
  if (view.etaWeeks != null) return `темп ~${fmtEta(view.etaWeeks)} нед до цели.`;
  return stagnantSuffix;
}

function exerciseLine(g: ExerciseGoalLine): string {
  const kindLabel = g.kind === "1rm" ? "по 1ПМ, кг" : "по весу, кг";
  const target = fmtNum(g.view.target);
  if (g.view.current == null) {
    return `- «${g.nameRu}» (цель ${kindLabel}): цель ${target}, истории пока нет.`;
  }
  const current = fmtNum(g.view.current);
  if (g.view.reached) {
    return `- «${g.nameRu}» (цель ${kindLabel}): ${current} из ${target} — ДОСТИГНУТА 🎯.`;
  }
  return `- «${g.nameRu}» (цель ${kindLabel}): сейчас ${current} из ${target} (${fmtPct(
    g.view,
  )}), ${paceTail(g.view, "темпа к цели пока нет (нужен рост).")}`;
}

function muscleLine(g: MuscleGoalLine): string {
  const target = fmtNum(g.view.target);
  if (g.view.current == null) {
    return `- ${g.label} (цель частоты): цель ${target} подх./нед, данных пока нет.`;
  }
  const current = fmtNum(g.view.current);
  if (g.view.reached) {
    return `- ${g.label} (цель частоты): ${current} из ${target} подх./нед — ДОСТИГНУТА 🎯.`;
  }
  return `- ${g.label} (цель частоты): ${current} из ${target} подх./нед (${fmtPct(
    g.view,
  )}), ${paceTail(g.view, "темпа пока нет (одно окно).")}`;
}

/** Блок «# Цель» для промпта тренера. Глубокий модуль (R-01): «есть ли что
 *  показать» решает сама функция → null, когда целей на упражнения/группы
 *  сегодняшней сессии нет (вызывающий не добавляет пустой заголовок). */
export function formatGoalsBlock(input: {
  exerciseGoals: ExerciseGoalLine[];
  muscleGoals: MuscleGoalLine[];
}): string | null {
  const { exerciseGoals, muscleGoals } = input;
  if (exerciseGoals.length === 0 && muscleGoals.length === 0) return null;

  const lines: string[] = [
    "# Цель (адресовать вслух цифрами; достигнута → поздравь и предложи следующую)",
    ...exerciseGoals.map(exerciseLine),
    ...muscleGoals.map(muscleLine),
  ];
  return lines.join("\n");
}
