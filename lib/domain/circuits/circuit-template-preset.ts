/** H14.1 — сборка пресета кругового шаблона из ввода билдера.
 *  Чистая domain-логика (R-7): без db/auth, на вход — уже-валидированная форма,
 *  на выход — нормализованные строки шаблона и упражнений для repo-вставки.
 *  Зеркалит нормализацию startCircuit (kind=reps → только targetReps;
 *  kind=duration → только targetDurationSec). */

export type CircuitExerciseKind = "reps" | "duration";

export type CircuitTemplatePresetInput = {
  name: string;
  description?: string | null;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  exercises: Array<{
    exerciseId: string;
    kind: CircuitExerciseKind;
    targetReps?: number | null;
    targetDurationSec?: number | null;
    targetWeightKg?: number | null;
    notes?: string | null;
  }>;
};

export type CircuitTemplatePresetExercise = {
  exerciseId: string;
  orderIdx: number;
  kind: CircuitExerciseKind;
  targetReps: number | null;
  targetDurationSec: number | null;
  targetWeightKg: number | null;
  notes: string | null;
};

export type CircuitTemplatePreset = {
  name: string;
  description: string | null;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  exercises: CircuitTemplatePresetExercise[];
};

function cleanNote(notes: string | null | undefined): string | null {
  const trimmed = (notes ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Дефолты целевого поля для НЕактивного kind при префилле в билдер (H14.5b):
 *  в БД у kind=reps targetDurationSec=null (и наоборот), но стейт билдера держит
 *  число, чтобы переключение «Повторения↔На время» имело осмысленное значение.
 *  Зеркалят DEFAULT_ITEM в CircuitBuilder (значения для пустой новой позиции). */
const ITEM_FALLBACK = { reps: 12, durationSec: 40 } as const;

/** Позиция в стейте CircuitBuilder. Структурно совпадает с локальным BuilderItem
 *  билдера — задаётся здесь, чтобы initial-prop edit-режима имел единый тип. */
export type CircuitBuilderItem = {
  uid: string;
  exerciseId: string;
  kind: CircuitExerciseKind;
  targetReps: number;
  targetDurationSec: number;
  targetWeightKg: number | null;
  notes: string;
};

/** Начальное состояние CircuitBuilder в режиме редактирования (H14.5b). */
export type CircuitBuilderInitial = {
  templateId: string;
  name: string;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  items: CircuitBuilderItem[];
};

/** Строка кругового шаблона из БД (шаблон + его упражнения) для префилла. */
export type CircuitTemplateRowForEdit = {
  id: string;
  name: string;
  totalRounds: number;
  restBetweenRoundsSec: number;
  restBetweenExercisesSec: number;
  exercises: Array<{
    id: string;
    exerciseId: string;
    orderIdx: number;
    kind: CircuitExerciseKind;
    targetReps: number | null;
    targetDurationSec: number | null;
    targetWeightKg: number | null;
    notes: string | null;
  }>;
};

/** H14.5b — разворачивает строку кругового шаблона из БД в начальное состояние
 *  билдера: сортирует упражнения по orderIdx, заполняет дефолтом целевое поле
 *  НЕактивного kind (стейт билдера держит число), null-заметку → "". Чистая
 *  (R-7): без db/auth. uid = id строки упражнения (детерминирован, не random). */
export function toCircuitBuilderInitial(
  row: CircuitTemplateRowForEdit,
): CircuitBuilderInitial {
  const items = [...row.exercises]
    .sort((a, b) => a.orderIdx - b.orderIdx)
    .map((e) => ({
      uid: e.id,
      exerciseId: e.exerciseId,
      kind: e.kind,
      targetReps: e.targetReps ?? ITEM_FALLBACK.reps,
      targetDurationSec: e.targetDurationSec ?? ITEM_FALLBACK.durationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes ?? "",
    }));

  return {
    templateId: row.id,
    name: row.name,
    totalRounds: row.totalRounds,
    restBetweenRoundsSec: row.restBetweenRoundsSec,
    restBetweenExercisesSec: row.restBetweenExercisesSec,
    items,
  };
}

/** Нормализует ввод билдера в пресет шаблона: проставляет orderIdx, очищает
 *  целевые поля по kind, тримит имя/заметки. Пустой список — ошибка
 *  (шаблон без упражнений бессмыслен, столп 4: пресет должен переиспользоваться). */
export function buildCircuitTemplatePreset(
  input: CircuitTemplatePresetInput,
): CircuitTemplatePreset {
  if (input.exercises.length === 0) {
    throw new Error("В круговом шаблоне должно быть хотя бы одно упражнение");
  }

  return {
    name: input.name.trim(),
    description: cleanNote(input.description),
    totalRounds: input.totalRounds,
    restBetweenRoundsSec: input.restBetweenRoundsSec,
    restBetweenExercisesSec: input.restBetweenExercisesSec,
    exercises: input.exercises.map((e, idx) => ({
      exerciseId: e.exerciseId,
      orderIdx: idx,
      kind: e.kind,
      targetReps: e.kind === "reps" ? e.targetReps ?? null : null,
      targetDurationSec:
        e.kind === "duration" ? e.targetDurationSec ?? null : null,
      targetWeightKg: e.targetWeightKg ?? null,
      notes: cleanNote(e.notes),
    })),
  };
}
