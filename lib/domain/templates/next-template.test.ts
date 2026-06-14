import { describe, expect, it } from "vitest";

import { buildNextTemplateItems, type WorkoutExerciseInput } from "./next-template";

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
});
