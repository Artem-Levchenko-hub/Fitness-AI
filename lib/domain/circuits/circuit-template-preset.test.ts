import { describe, expect, it } from "vitest";

import {
  buildCircuitTemplatePreset,
  type CircuitTemplatePresetInput,
} from "./circuit-template-preset";

function base(
  exercises: CircuitTemplatePresetInput["exercises"],
): CircuitTemplatePresetInput {
  return {
    name: "  Full body  ",
    totalRounds: 4,
    restBetweenRoundsSec: 90,
    restBetweenExercisesSec: 20,
    exercises,
  };
}

describe("buildCircuitTemplatePreset", () => {
  it("нормализует reps-упражнение: targetReps остаётся, duration обнуляется", () => {
    const preset = buildCircuitTemplatePreset(
      base([
        {
          exerciseId: "ex-1",
          kind: "reps",
          targetReps: 12,
          targetDurationSec: 40,
          targetWeightKg: 20,
          notes: "техника",
        },
      ]),
    );
    expect(preset.exercises[0]).toMatchObject({
      exerciseId: "ex-1",
      orderIdx: 0,
      kind: "reps",
      targetReps: 12,
      targetDurationSec: null,
      targetWeightKg: 20,
      notes: "техника",
    });
  });

  it("нормализует duration-упражнение: targetDurationSec остаётся, reps обнуляется", () => {
    const preset = buildCircuitTemplatePreset(
      base([
        {
          exerciseId: "ex-2",
          kind: "duration",
          targetReps: 15,
          targetDurationSec: 45,
        },
      ]),
    );
    expect(preset.exercises[0]).toMatchObject({
      kind: "duration",
      targetReps: null,
      targetDurationSec: 45,
      targetWeightKg: null,
    });
  });

  it("проставляет последовательный orderIdx, сохраняя порядок", () => {
    const preset = buildCircuitTemplatePreset(
      base([
        { exerciseId: "a", kind: "reps", targetReps: 10 },
        { exerciseId: "b", kind: "reps", targetReps: 10 },
        { exerciseId: "c", kind: "duration", targetDurationSec: 30 },
      ]),
    );
    expect(preset.exercises.map((e) => [e.exerciseId, e.orderIdx])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("тримит имя и пустые заметки → null", () => {
    const preset = buildCircuitTemplatePreset(
      base([{ exerciseId: "a", kind: "reps", targetReps: 8, notes: "   " }]),
    );
    expect(preset.name).toBe("Full body");
    expect(preset.exercises[0].notes).toBeNull();
  });

  it("description пустой/пробельный → null, непустой тримится", () => {
    const empty = buildCircuitTemplatePreset({
      ...base([{ exerciseId: "a", kind: "reps", targetReps: 8 }]),
      description: "  ",
    });
    expect(empty.description).toBeNull();
    const filled = buildCircuitTemplatePreset({
      ...base([{ exerciseId: "a", kind: "reps", targetReps: 8 }]),
      description: "  моя круговая ",
    });
    expect(filled.description).toBe("моя круговая");
  });

  it("переносит параметры круга без изменений", () => {
    const preset = buildCircuitTemplatePreset(
      base([{ exerciseId: "a", kind: "reps", targetReps: 8 }]),
    );
    expect(preset.totalRounds).toBe(4);
    expect(preset.restBetweenRoundsSec).toBe(90);
    expect(preset.restBetweenExercisesSec).toBe(20);
  });

  it("пустой список упражнений → ошибка", () => {
    expect(() => buildCircuitTemplatePreset(base([]))).toThrow(
      /хотя бы одно упражнение/,
    );
  });
});
