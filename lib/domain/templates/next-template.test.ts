import { describe, expect, it } from "vitest";

import {
  buildNextTemplateItems,
  templateItemsFromWorkout,
  type WorkoutExerciseInput,
} from "./next-template";

const ex = (
  exerciseId: string,
  sets: { weightKg: number | null; reps: number; setType?: string }[],
): WorkoutExerciseInput => ({
  exerciseId,
  sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, setType: s.setType ?? "working" })),
});

describe("buildNextTemplateItems", () => {
  it("returns [] for no exercises", () => {
    expect(buildNextTemplateItems([])).toEqual([]);
  });

  it("progresses reps when top set is below the rep ceiling (keeps weight)", () => {
    const out = buildNextTemplateItems([
      ex("bench", [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 9 }]),
    ]);
    expect(out).toEqual([
      {
        exerciseId: "bench",
        targetSets: 2,
        targetRepsMin: 11,
        targetRepsMax: 12,
        targetWeightKg: 50,
        targetRestSeconds: 120,
      },
    ]);
  });

  it("adds weight and resets reps when the rep ceiling (12) is hit", () => {
    const out = buildNextTemplateItems([ex("squat", [{ weightKg: 60, reps: 12 }])]);
    expect(out[0]).toMatchObject({
      exerciseId: "squat",
      targetWeightKg: 62.5,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetSets: 1,
    });
  });

  it("progresses bodyweight reps with no weight and no 12 cap", () => {
    const out = buildNextTemplateItems([
      ex("pullup", [{ weightKg: null, reps: 15 }, { weightKg: null, reps: 14 }]),
    ]);
    expect(out[0]).toMatchObject({
      exerciseId: "pullup",
      targetWeightKg: null,
      targetRepsMin: 16,
      targetRepsMax: 18,
      targetSets: 2,
    });
  });

  it("uses reps at the heaviest working set across mixed weights", () => {
    const out = buildNextTemplateItems([
      ex("row", [{ weightKg: 40, reps: 12 }, { weightKg: 50, reps: 8 }]),
    ]);
    // top weight = 50, its reps = 8 → progress reps 9-11
    expect(out[0]).toMatchObject({
      targetWeightKg: 50,
      targetRepsMin: 9,
      targetRepsMax: 11,
    });
  });

  it("ignores warmup/non-working sets", () => {
    const out = buildNextTemplateItems([
      ex("ohp", [
        { weightKg: 20, reps: 15, setType: "warmup" },
        { weightKg: 40, reps: 10, setType: "working" },
      ]),
    ]);
    expect(out[0]).toMatchObject({ targetWeightKg: 40, targetRepsMin: 11, targetSets: 1 });
  });

  it("excludes exercises with no working sets", () => {
    const out = buildNextTemplateItems([ex("curl", [{ weightKg: 10, reps: 12, setType: "warmup" }])]);
    expect(out).toEqual([]);
  });

  it("прогрессирует myo-reps по активации, а не по коротким мини-подходам", () => {
    const out = buildNextTemplateItems([
      {
        exerciseId: "fly",
        setScheme: "myo_reps",
        myoMiniSets: 3,
        myoRepsPercent: 30,
        myoRestSeconds: 30,
        sets: [
          {
            weightKg: 20,
            reps: 12,
            setType: "working",
            myoRole: "activation",
          },
          { weightKg: 20, reps: 4, setType: "working", myoRole: "mini" },
          { weightKg: 20, reps: 3, setType: "working", myoRole: "mini" },
        ],
      },
    ]);

    expect(out[0]).toMatchObject({
      targetSets: 4,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetWeightKg: 22.5,
      setScheme: "myo_reps",
      myoMiniSets: 3,
      myoRepsPercent: 30,
      myoRestSeconds: 30,
    });
  });
});

describe("templateItemsFromWorkout (точная передача без прогрессии)", () => {
  it("фиксирует факт: подходы, диапазон повторов [min,max], топ-вес", () => {
    const out = templateItemsFromWorkout([
      ex("bench", [
        { weightKg: 50, reps: 8 },
        { weightKg: 50, reps: 7 },
        { weightKg: 50, reps: 6 },
      ]),
    ]);
    expect(out[0]).toEqual({
      exerciseId: "bench",
      targetSets: 3,
      targetRepsMin: 6,
      targetRepsMax: 8,
      targetWeightKg: 50,
      targetRestSeconds: 120,
    });
  });

  it("НЕ добавляет вес даже на потолке повторов (в отличие от прогрессии)", () => {
    const out = templateItemsFromWorkout([ex("squat", [{ weightKg: 60, reps: 12 }])]);
    expect(out[0]).toMatchObject({ targetWeightKg: 60, targetRepsMin: 12, targetRepsMax: 12 });
  });

  it("bodyweight → вес null, диапазон реальных повторов", () => {
    const out = templateItemsFromWorkout([
      ex("pullup", [{ weightKg: null, reps: 12 }, { weightKg: null, reps: 10 }]),
    ]);
    expect(out[0]).toMatchObject({
      targetWeightKg: null,
      targetRepsMin: 10,
      targetRepsMax: 12,
      targetSets: 2,
    });
  });

  it("топ-вес берётся из самого тяжёлого рабочего подхода", () => {
    const out = templateItemsFromWorkout([
      ex("row", [{ weightKg: 40, reps: 12 }, { weightKg: 55, reps: 6 }]),
    ]);
    expect(out[0]).toMatchObject({ targetWeightKg: 55, targetRepsMin: 6, targetRepsMax: 12 });
  });

  it("игнорирует разминочные и отбрасывает упражнения без рабочих", () => {
    const out = templateItemsFromWorkout([
      ex("ohp", [
        { weightKg: 20, reps: 15, setType: "warmup" },
        { weightKg: 40, reps: 10, setType: "working" },
      ]),
      ex("curl", [{ weightKg: 10, reps: 12, setType: "warmup" }]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ exerciseId: "ohp", targetSets: 1, targetWeightKg: 40 });
  });

  it("сохраняет myo-reps и диапазон активации без мини-повторов", () => {
    const out = templateItemsFromWorkout([
      {
        exerciseId: "curl",
        setScheme: "myo_reps",
        myoMiniSets: 3,
        myoRepsPercent: 30,
        myoRestSeconds: 25,
        sets: [
          {
            weightKg: 15,
            reps: 10,
            setType: "working",
            myoRole: "activation",
          },
          { weightKg: 15, reps: 3, setType: "working", myoRole: "mini" },
        ],
      },
    ]);

    expect(out[0]).toMatchObject({
      targetSets: 4,
      targetRepsMin: 10,
      targetRepsMax: 10,
      setScheme: "myo_reps",
      myoRestSeconds: 25,
    });
  });
});
