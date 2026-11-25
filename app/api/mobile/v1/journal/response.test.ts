import { describe, expect, it } from "vitest";

import type { ActiveWorkout } from "@/lib/repos/workouts.repo";

import { serializeJournalWorkout } from "./response";

const startedAt = new Date("2026-11-25T10:00:00Z");
const retiredAt = new Date("2026-11-25T10:10:00Z");
const completedAt = new Date("2026-11-25T10:05:00Z");
const savedAt = new Date("2026-11-25T10:06:00Z");
const workout: ActiveWorkout = {
  id: "workout", name: "Силовая", status: "active", startedAt, finishedAt: null,
  exercises: [{
    id: "retired", exerciseId: "squat", position: 0, exerciseNameRu: "Приседания", exerciseNameEn: "Squat", exerciseSlug: "squat",
    targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: null, targetRestSeconds: 120,
    myoReps: false, myoMiniSets: 3, myoMiniReps: 5, myoMiniRestSeconds: 20, replacedAt: retiredAt,
    sets: [{ id: "performed", setIndex: 0, setType: "working", weightKg: 40, reps: 8, effort: "failure", rpe: null, restSeconds: 120, completedAt, savedAt }],
  }, {
    id: "planned", exerciseId: "press", position: 1, exerciseNameRu: "Жим", exerciseNameEn: "Press", exerciseSlug: "press",
    targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: null, targetRestSeconds: 120,
    myoReps: false, myoMiniSets: 3, myoMiniReps: 5, myoMiniRestSeconds: 20, replacedAt: null, sets: [],
  }],
};

describe("native journal retirement compatibility", () => {
  it("omits retired assignments from the active plan so older phones cannot log them again", () => {
    const serialized = serializeJournalWorkout(workout);
    expect(serialized.exercises.map((exercise) => exercise.id)).toEqual(["planned"]);
    expect(serialized.autoFinishAt).toBeNull();
  });

  it("keeps retired assignments with their performed sets and effort in completed history", () => {
    const serialized = serializeJournalWorkout({ ...workout, status: "completed" });
    expect(serialized.exercises.map((exercise) => exercise.id)).toEqual(["retired", "planned"]);
    expect(serialized.exercises[0]).toMatchObject({
      replacedAt: retiredAt,
      sets: [{ id: "performed", setIndex: 0, weightKg: 40, reps: 8, effort: "failure" }],
    });
    expect(serialized.autoFinishAt).toBeNull();
  });

  it("keeps an empty active plan open after every assignment is removed", () => {
    const serialized = serializeJournalWorkout({ ...workout, exercises: [workout.exercises[0]] });
    expect(serialized.exercises).toEqual([]);
    expect(serialized.autoFinishAt).toBeNull();
  });
});
