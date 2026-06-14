/**
 * H15.4 — дренаж offline-outbox при реконнекте.
 *
 * Когда сеть вернулась, незадренированные мутации (запись подхода H15.3b,
 * завершение тренировки H15.3c) реплеятся ЧЕРЕЗ ТОТ ЖЕ server-action, под тем
 * же `clientId` — идемпотентность держит БД (workout_sets.client_set_id
 * partial-unique + onConflictDoNothing; finishWorkout фильтрует status=active).
 * Двойной дренаж дублей не создаёт.
 *
 * Этот модуль — ЧИСТАЯ оркестрация (R-7): реплееры и `remove` ИНЪЕКТИРУЮТСЯ
 * вызывающим (компонент подставляет server-actions + outbox.remove), поэтому
 * здесь нет импортов server/IndexedDB и логика юнит-тестируема в node.
 * Builders payload→FormData тоже чистые — реплей идёт строго через FormData,
 * как онлайн-сабмит (форма payload-а мутации спрятана от server-action).
 */

import type { OutboxMutation } from "./outbox";

/** Поля recordSet-мутации в порядке формы recordSetAction (зеркало SetInput). */
const RECORD_SET_FIELDS = [
  "workoutId",
  "workoutExerciseId",
  "setIndex",
  "weightKg",
  "reps",
  "rpe",
  "restSeconds",
  "clientSetId",
] as const;

/** payload recordSet → FormData для реплея через recordSetAction. */
export function recordSetFormData(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const field of RECORD_SET_FIELDS) {
    fd.set(field, String(payload[field] ?? ""));
  }
  return fd;
}

/** payload finishWorkout → FormData для реплея через replayFinishWorkoutAction. */
export function finishFormData(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.set("workoutId", String(payload.workoutId ?? ""));
  fd.set("feeling", String(payload.feeling ?? ""));
  fd.set("feelingTag", String(payload.feelingTag ?? ""));
  return fd;
}

/**
 * Инъектируемые операции дренажа. Каждый реплеер возвращает `true`, если
 * мутация синхронизирована (можно удалить из outbox), `false` — оставить (не
 * прошла валидация/сервер недоступен). `remove` чистит синхронизированную
 * запись.
 */
export type DrainReplayers = {
  recordSet: (mutation: OutboxMutation) => Promise<boolean>;
  finishWorkout: (mutation: OutboxMutation) => Promise<boolean>;
  remove: (clientId: string) => Promise<void>;
};

export type DrainResult = {
  /** Сколько мутаций реально синхронизировано и удалено из очереди. */
  synced: number;
  /** Сколько осталось (не прошли реплей — попробуем при следующем online). */
  remaining: number;
};

/**
 * Реплеит мутации (предполагается FIFO — listPending уже сортирует по queuedAt:
 * подходы раньше финиша). Удаляет только успешно синхронизированные; падение
 * реплея НЕ роняет дренаж и НЕ теряет мутацию (столп 4) — она ждёт следующего
 * online. Неизвестный kind игнорируется (не удаляется — fail-soft R-10).
 */
export async function drainOutbox(
  mutations: OutboxMutation[],
  replayers: DrainReplayers,
): Promise<DrainResult> {
  let synced = 0;
  for (const mutation of mutations) {
    let ok = false;
    try {
      if (mutation.kind === "recordSet") {
        ok = await replayers.recordSet(mutation);
      } else if (mutation.kind === "finishWorkout") {
        ok = await replayers.finishWorkout(mutation);
      }
    } catch {
      ok = false; // сетевой/серверный сбой → оставить в очереди
    }
    if (ok) {
      await replayers.remove(mutation.clientId);
      synced += 1;
    }
  }
  return { synced, remaining: mutations.length - synced };
}
