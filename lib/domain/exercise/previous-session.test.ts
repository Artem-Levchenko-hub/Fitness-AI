import { describe, expect, it } from "vitest";

import { summarizePreviousSession } from "./previous-session";
import type { ExerciseSession } from "./set-history";

/** Хелпер: сессия упражнения с дефолтами. */
function session(
  sets: ExerciseSession["sets"],
  o: Partial<ExerciseSession> = {},
): ExerciseSession {
  return {
    workoutId: "w1",
    date: new Date("2026-06-10T08:00:00Z"),
    best1rm: 0,
    sets,
    ...o,
  };
}

function set(o: Partial<ExerciseSession["sets"][number]>): ExerciseSession["sets"][number] {
  return {
    id: "s1",
    weightKg: 80,
    reps: 8,
    rpe: null,
    setType: "working",
    ...o,
  };
}

describe("summarizePreviousSession", () => {
  it("null-сессия → null (упражнение без истории, R-37 без строки)", () => {
    expect(summarizePreviousSession(null)).toBeNull();
  });

  it("пустые подходы → null", () => {
    expect(summarizePreviousSession(session([]))).toBeNull();
  });

  it("рабочие подходы: строка из них, префилл = вес последнего рабочего", () => {
    const out = summarizePreviousSession(
      session([
        set({ id: "a", weightKg: 80, reps: 8 }),
        set({ id: "b", weightKg: 80, reps: 8 }),
        set({ id: "c", weightKg: 77.5, reps: 6 }),
      ]),
    );
    expect(out).toEqual({
      sets: [
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 8 },
        { weightKg: 77.5, reps: 6 },
      ],
      prefillWeightKg: 77.5,
    });
  });

  it("есть warmup и working → показываем только working (приоритет рабочих)", () => {
    const out = summarizePreviousSession(
      session([
        set({ id: "w", weightKg: 40, reps: 10, setType: "warmup" }),
        set({ id: "a", weightKg: 90, reps: 5, setType: "working" }),
        set({ id: "b", weightKg: 90, reps: 4, setType: "working" }),
      ]),
    );
    expect(out).toEqual({
      sets: [
        { weightKg: 90, reps: 5 },
        { weightKg: 90, reps: 4 },
      ],
      prefillWeightKg: 90,
    });
  });

  it("рабочих нет (только разминка) → показываем все, префилл = вес последнего", () => {
    const out = summarizePreviousSession(
      session([
        set({ id: "w1", weightKg: 30, reps: 12, setType: "warmup" }),
        set({ id: "w2", weightKg: 35, reps: 10, setType: "warmup" }),
      ]),
    );
    expect(out).toEqual({
      sets: [
        { weightKg: 30, reps: 12 },
        { weightKg: 35, reps: 10 },
      ],
      prefillWeightKg: 35,
    });
  });
});
