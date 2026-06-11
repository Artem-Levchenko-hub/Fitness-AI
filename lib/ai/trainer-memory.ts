import { trainerSchema } from "./trainer-parse";

/** H5.5 «Память тренера»: чистый (env-free, R-7) модуль, превращающий прошлые
 *  AiAnalysis того же формата в блок контекста. Логику парса resultJson и
 *  формат блока держим здесь, чтобы юнит-тестировать без БД/SKIP_ENV. Загрузку
 *  строк из ai_analyses делает context-builder. */

export type PastAdvice = {
  createdAt: Date;
  /** nextSessionFocus прошлого разбора — рекомендация, которую мы дали в тот
   *  раз. null для legacy markdown-only (resultJson отсутствует/не та схема). */
  focus: string | null;
  /** overallScore прошлого разбора; null если недоступен. */
  score: number | null;
};

/** Достаёт ключевую прошлую рекомендацию (nextSessionFocus) + оценку из jsonb
 *  resultJson. Невалидный/legacy resultJson → null-поля (fail-soft R-10). */
export function extractPastAdvice(row: {
  createdAt: Date;
  resultJson: unknown;
}): PastAdvice {
  const parsed = trainerSchema.safeParse(row.resultJson);
  if (!parsed.success) {
    return { createdAt: row.createdAt, focus: null, score: null };
  }
  const focus = parsed.data.nextSessionFocus.trim() || null;
  return { createdAt: row.createdAt, focus, score: parsed.data.overallScore };
}

const HEADER = "# Память тренера (твои прошлые рекомендации этому атлету)";

/** Рендерит блок памяти для промпта. Строки без focus (legacy) отсеиваются.
 *  Сортирует по дате asc — последняя строка = самая свежая рекомендация, на
 *  выполнение которой промпт явно просит сослаться. formatDate инжектируется
 *  (детерминизм теста без локали ICU). */
export function formatTrainerMemoryBlock(
  rows: PastAdvice[],
  formatDate: (d: Date) => string,
): string {
  const withFocus = rows
    .filter((r): r is PastAdvice & { focus: string } => Boolean(r.focus))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (withFocus.length === 0) {
    return `${HEADER}\n_(прошлых разборов этого формата ещё нет — это первый; ссылаться не на что)_`;
  }

  const lines = withFocus.map((r) => {
    const score = r.score != null ? ` (оценка ${r.score}/100)` : "";
    return `- ${formatDate(r.createdAt)}${score}: ты советовал «${r.focus}»`;
  });

  const last = withFocus[withFocus.length - 1];

  return [
    HEADER,
    "",
    "От старых к свежим:",
    ...lines,
    "",
    `ОБЯЗАТЕЛЬНО оцени выполнение ПОСЛЕДНЕЙ рекомендации («${last.focus}») в сегодняшней сессии и заполни поле pastAdviceFollowUp: начни с «В прошлый раз я советовал …», затем скажи — выполнено или нет, с цифрами из сегодняшних подходов.`,
  ].join("\n");
}
