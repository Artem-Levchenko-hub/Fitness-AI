/** H16.3 — стадии «живого» лоадера ожидания разбора (Ahead-паттерн): пока
 *  тренер думает, показываем последовательность подписанных стадий, которая
 *  ВИДИМО движется во времени — вместо одного зависшего спиннера.
 *
 *  ЧЕСТНОСТЬ (ограничение плана §5★ H16.3): у LLM-стрима нет читаемого
 *  токен-прогресса, реальных сигналов всего три (нет байт / байты>0 /
 *  loading-result). Эти стадии — ЯВНО косметические по таймеру, НЕ реальные
 *  фазы стрима. «Сверяюсь с книгой» при этом не фикция: RAG-ретрив реально
 *  выполняется на сервере ДО первого байта (app/api/ai/trainer/stream), просто
 *  клиенту до-байтовый период неразличим — поэтому показываем его как
 *  пройденную стадию по косметической ленте, а не как живой сигнал. */

export type WaitingStage = { id: string; label: string };

export const WAITING_STAGES: readonly WaitingStage[] = [
  { id: "read", label: "Читаю твои подходы" },
  { id: "book", label: "Сверяюсь с книгой тренера" },
  { id: "write", label: "Пишу разбор" },
] as const;

/** Момент (мс от старта ожидания), когда каждая стадия становится активной.
 *  Первая — всегда 0. Последняя залипает (разбор может идти дольше ленты). */
const STAGE_START_MS = [0, 4000, 9000] as const;

/** Индекс активной стадии по прошедшему времени. Залипает на последней — ни
 *  при каком ожидании не «завершает» всё (честно: разбор ещё идёт). Чистая. */
export function activeStageIndex(
  elapsedMs: number,
  starts: readonly number[] = STAGE_START_MS,
): number {
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    if (elapsedMs >= starts[i]!) idx = i;
  }
  return idx;
}

export type StageState = "done" | "active" | "pending";

/** Состояние каждой стадии: пройденные `done`, текущая `active`, будущие
 *  `pending`. Последняя стадия максимум `active` — массив НИКОГДА не all-done
 *  (нет ложного индикатора «готово», пока разбор не пришёл). Чистая. */
export function stageStates(
  elapsedMs: number,
  starts: readonly number[] = STAGE_START_MS,
): StageState[] {
  const active = activeStageIndex(elapsedMs, starts);
  return starts.map((_, i) =>
    i < active ? "done" : i === active ? "active" : "pending",
  );
}
