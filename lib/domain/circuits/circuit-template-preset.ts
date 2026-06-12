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
