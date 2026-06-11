import type { TrainerResponse } from "@/lib/ai/trainer-parse";

/** H5.4 — проверяемый шаблон тона «как тренер». Живой тренер после сессии
 *  всегда: (1) сравнивает с прошлым в цифрах, (2) отмечает что получилось,
 *  (3) даёт ОДНУ конкретную корректировку, (4) задаёт завершающий вопрос.
 *
 *  Эта чистая функция — единая точка истины «несёт ли разбор все 4 элемента».
 *  Переиспользуется и в юнит-тесте, и в прод-гейте. Env-free (R-7): зависит
 *  только от формы TrainerResponse, не от db/ai/env. */

export type CoachTemplateCheck = {
  /** Явная отсылка к прошлому в цифрах: ≥1 упражнение с прошлой топ-сессией. */
  pastReference: boolean;
  /** Блок «что хорошо» заполнен. */
  whatWorked: boolean;
  /** ОДНА конкретная корректировка на след. сессию (nextSessionFocus). */
  correction: boolean;
  /** Завершающий вопрос-приглашение (содержит знак вопроса). */
  followUpQuestion: boolean;
};

export function assertCoachTemplate(r: TrainerResponse): CoachTemplateCheck {
  const q = (r.followUpQuestion ?? "").trim();
  return {
    pastReference: r.exerciseComparisons.some((c) => c.prevTopSet !== null),
    whatWorked: (r.whatWorked ?? "").trim().length > 0,
    correction: r.nextSessionFocus.trim().length > 0,
    followUpQuestion: q.length > 0 && q.includes("?"),
  };
}

/** Все 4 элемента шаблона на месте — разбор звучит как живой тренер. */
export function isCoachTemplateComplete(r: TrainerResponse): boolean {
  const c = assertCoachTemplate(r);
  return c.pastReference && c.whatWorked && c.correction && c.followUpQuestion;
}
