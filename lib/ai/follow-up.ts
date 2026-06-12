/** H5.8 «Спросить тренера»: чистая сборка payload для одного follow-up вопроса
 *  по готовому разбору. БЕЗ импортов ai/deepseek/env — юнит-тестируется без сети
 *  (R-7). Переиспользует существующий /api/ai/coach route: ведущее assistant-
 *  сообщение = текст разбора («её разбор»), workout-контекст route подмешивает
 *  сам через buildCoachContext («эта тренировка»). Один вопрос/один ответ —
 *  истории чата в БД нет (finalize не вызывается). */

export type FollowUpMessage = { role: "assistant" | "user"; content: string };

/** Собирает сообщения для коуч-route из текста разбора и вопроса атлета.
 *  Возвращает null, если вопрос пустой (спрашивать нечего). Пустой текст
 *  разбора → только user-сообщение (ответ обопрётся на workout-контекст). */
export function buildFollowUpMessages(
  analysisText: string,
  question: string,
): FollowUpMessage[] | null {
  const q = question.trim();
  if (!q) return null;

  const messages: FollowUpMessage[] = [];
  const analysis = analysisText.trim();
  if (analysis) {
    messages.push({ role: "assistant", content: analysis });
  }
  messages.push({ role: "user", content: q });
  return messages;
}
