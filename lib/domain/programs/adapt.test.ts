import { describe, expect, it } from "vitest";

import {
  buildInPlaceAdaptation,
  mergeProgressionIntoItems,
  pickSubstitute,
  type AdaptItem,
  type SubstituteCandidate,
} from "./adapt";
import type { WorkoutExerciseInput } from "@/lib/domain/templates/next-template";

const cur = (
  exerciseId: string,
  position: number,
  over: Partial<AdaptItem> = {},
): AdaptItem => ({
  exerciseId,
  position,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: 50,
  targetRestSeconds: 120,
  notes: null,
  ...over,
});

const ex = (
  exerciseId: string,
  sets: { weightKg: number | null; reps: number; setType?: string }[],
): WorkoutExerciseInput => ({
  exerciseId,
  sets: sets.map((s) => ({
    weightKg: s.weightKg,
    reps: s.reps,
    setType: s.setType ?? "working",
  })),
});

describe("mergeProgressionIntoItems", () => {
  it("updates targets of a matched exercise, keeps identity/position/notes", () => {
    const out = mergeProgressionIntoItems(
      [cur("bench", 0, { notes: "по ощущениям" })],
      [
        {
          exerciseId: "bench",
          targetSets: 4,
          targetRepsMin: 9,
          targetRepsMax: 11,
          targetWeightKg: 52.5,
          targetRestSeconds: 120,
        },
      ],
    );
    expect(out[0]).toEqual({
      exerciseId: "bench",
      position: 0,
      targetSets: 4,
      targetRepsMin: 9,
      targetRepsMax: 11,
      targetWeightKg: 52.5,
      targetRestSeconds: 120,
      notes: "по ощущениям",
    });
  });

  it("leaves an exercise without progression unchanged (skipped this session)", () => {
    const item = cur("calf", 1);
    const out = mergeProgressionIntoItems([item], []);
    expect(out[0]).toEqual(item);
  });

  it("preserves current order regardless of next order", () => {
    const out = mergeProgressionIntoItems(
      [cur("a", 0), cur("b", 1)],
      [
        { exerciseId: "b", targetSets: 3, targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 30, targetRestSeconds: 90 },
        { exerciseId: "a", targetSets: 3, targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 80, targetRestSeconds: 180 },
      ],
    );
    expect(out.map((i) => i.exerciseId)).toEqual(["a", "b"]);
    expect(out[0].targetWeightKg).toBe(80);
  });
});

describe("pickSubstitute", () => {
  const cand = (
    id: string,
    muscles: string[],
    isStagnant = false,
  ): SubstituteCandidate => ({ exerciseId: id, primaryMuscles: muscles, isStagnant });

  it("returns the first same-muscle, non-stagnant, non-excluded candidate", () => {
    const out = pickSubstitute(
      ["chest"],
      [cand("incline", ["chest"]), cand("flyes", ["chest"])],
      [],
    );
    expect(out).toBe("incline");
  });

  it("skips stagnant candidates", () => {
    const out = pickSubstitute(
      ["chest"],
      [cand("incline", ["chest"], true), cand("flyes", ["chest"])],
      [],
    );
    expect(out).toBe("flyes");
  });

  it("skips excluded candidates (already in template)", () => {
    const out = pickSubstitute(
      ["chest"],
      [cand("incline", ["chest"]), cand("flyes", ["chest"])],
      ["incline"],
    );
    expect(out).toBe("flyes");
  });

  it("returns null when no candidate shares a primary muscle", () => {
    expect(pickSubstitute(["chest"], [cand("squat", ["quads"])], [])).toBeNull();
  });
});

describe("buildInPlaceAdaptation", () => {
  it("progresses targets in place without swap when no substitutes given", () => {
    const out = buildInPlaceAdaptation(
      [cur("bench", 0, { targetWeightKg: 50 })],
      [ex("bench", [{ weightKg: 50, reps: 12 }])],
    );
    expect(out.swap).toBeNull();
    // hit rep ceiling 12 → +2.5kg, reps reset 8-12
    expect(out.items[0]).toMatchObject({
      exerciseId: "bench",
      targetWeightKg: 52.5,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });
  });

  it("applies exactly one swap and resets the swapped exercise to a fresh start", () => {
    const out = buildInPlaceAdaptation(
      [cur("bench", 0), cur("squat", 1)],
      [ex("bench", [{ weightKg: 50, reps: 10 }]), ex("squat", [{ weightKg: 80, reps: 8 }])],
      { bench: "incline", squat: "front-squat" },
    );
    expect(out.swap).toEqual({ fromExerciseId: "bench", toExerciseId: "incline" });
    // only the first (by position) swap is applied
    expect(out.items[0]).toMatchObject({
      exerciseId: "incline",
      targetWeightKg: null,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });
    // second stays progressed, NOT swapped
    expect(out.items[1].exerciseId).toBe("squat");
  });

  it("ignores a substitute that equals the current exercise", () => {
    const out = buildInPlaceAdaptation(
      [cur("bench", 0)],
      [ex("bench", [{ weightKg: 50, reps: 10 }])],
      { bench: "bench" },
    );
    expect(out.swap).toBeNull();
    expect(out.items[0].exerciseId).toBe("bench");
  });

  it("adapted items differ from the original, and the original is not mutated (snapshot stays intact for revert)", () => {
    const original = [cur("bench", 0, { targetWeightKg: 50 })];
    const out = buildInPlaceAdaptation(original, [
      ex("bench", [{ weightKg: 50, reps: 12 }]),
    ]);
    // Снимок-оригинал, который repo сохраняет ДО правки, не должен мутироваться
    // адаптацией — иначе откат вернёт уже изменённые цели.
    expect(original[0].targetWeightKg).toBe(50);
    // Адаптация реально меняет цель → откат к снимку имеет смысл.
    expect(out.items[0].targetWeightKg).toBe(52.5);
    expect(out.items[0].targetWeightKg).not.toBe(original[0].targetWeightKg);
  });

  it("keeps Myo protocol intact and derives mini reps from the activation set", () => {
    const out = buildInPlaceAdaptation(
      [
        cur("leg-extension", 0, {
          targetSets: 1,
          targetRepsMin: 12,
          targetRepsMax: 20,
          targetWeightKg: 40,
          myoReps: true,
          myoMiniSets: 3,
          myoMiniReps: 5,
          myoMiniRestSeconds: 30,
        }),
      ],
      [
        ex("leg-extension", [
          { weightKg: 40, reps: 14 },
          { weightKg: 40, reps: 4 },
          { weightKg: 40, reps: 4 },
          { weightKg: 40, reps: 4 },
        ]),
      ],
    );

    expect(out.items[0]).toMatchObject({
      targetSets: 1,
      targetRepsMin: 12,
      targetRepsMax: 20,
      targetWeightKg: 40,
      myoReps: true,
      myoMiniSets: 3,
      myoMiniReps: 4,
      myoMiniRestSeconds: 30,
    });
  });

  it("does not advance a plan when fresh recovery data is cautionary", () => {
    const out = buildInPlaceAdaptation(
      [cur("bench", 0, { targetWeightKg: 50 })],
      [ex("bench", [{ weightKg: 50, reps: 12 }])],
      {},
      { readiness: "caution" },
    );
    expect(out.items[0]).toMatchObject({
      targetWeightKg: 50,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });
  });
});
