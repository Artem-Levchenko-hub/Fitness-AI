import { describe, expect, it } from "vitest";

import {
  buildCircuitAdaptation,
  freshSwapTarget,
  median,
  type CircuitPerf,
  type CircuitPlan,
} from "./adapt-circuit";

const REPS_EX = (
  exerciseId: string,
  targetReps: number,
  targetWeightKg: number | null = null,
) => ({
  exerciseId,
  kind: "reps" as const,
  targetReps,
  targetDurationSec: null,
  targetWeightKg,
});

const DUR_EX = (exerciseId: string, targetDurationSec: number) => ({
  exerciseId,
  kind: "duration" as const,
  targetReps: null,
  targetDurationSec,
  targetWeightKg: null,
});

const plan = (over: Partial<CircuitPlan> = {}): CircuitPlan => ({
  totalRounds: 4,
  restBetweenRoundsSec: 60,
  restBetweenExercisesSec: 15,
  exercises: [],
  ...over,
});

const perf = (over: Partial<CircuitPerf> = {}): CircuitPerf => ({
  byExercise: {},
  roundsCompleted: 4,
  medianRpe: 8,
  ...over,
});

const perfEx = (
  exerciseId: string,
  over: Partial<CircuitPerf["byExercise"][string]> = {},
) => ({
  exerciseId,
  medianReps: null,
  medianDurationSec: null,
  medianWeightKg: null,
  completedRounds: 4,
  noData: false,
  ...over,
});

describe("median", () => {
  it("returns null for empty", () => expect(median([])).toBeNull());
  it("odd length → middle", () => expect(median([3, 1, 2])).toBe(2));
  it("even length → average of two middles", () =>
    expect(median([1, 2, 3, 4])).toBe(2.5));
});

describe("buildCircuitAdaptation — reps", () => {
  it("сильное недовыполнение (10→3) снижает цель к факту и хинтит свап", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("pullup", 10)] }),
      perf({ byExercise: { pullup: perfEx("pullup", { medianReps: 3 }) } }),
    );
    expect(r.plan.exercises[0]!.targetReps).toBe(3);
    expect(r.changes).toContainEqual({
      type: "reps",
      exerciseId: "pullup",
      from: 10,
      to: 3,
    });
    expect(r.swapHints).toContain("pullup"); // 0.3 ≤ 0.35 → свап-кандидат
  });

  it("перевыполнение (план занижен 5→20) поднимает цель к факту, без свапа", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("raise", 5)] }),
      perf({ byExercise: { raise: perfEx("raise", { medianReps: 20 }) } }),
    );
    expect(r.plan.exercises[0]!.targetReps).toBe(20);
    expect(r.swapHints).not.toContain("raise");
  });

  it("попал в план + лёгкий RPE → прогресс цели", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("pushup", 30)] }),
      perf({
        medianRpe: 6,
        byExercise: { pushup: perfEx("pushup", { medianReps: 30 }) },
      }),
    );
    expect(r.plan.exercises[0]!.targetReps).toBe(33); // +10% от 30
  });

  it("попал в план + тяжёлый RPE → цель без изменений", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("pushup", 30)] }),
      perf({
        medianRpe: 9,
        byExercise: { pushup: perfEx("pushup", { medianReps: 30 }) },
      }),
    );
    expect(r.plan.exercises[0]!.targetReps).toBe(30);
    expect(r.changes.find((c) => c.type === "reps")).toBeUndefined();
  });

  it("упражнение без данных не трогается", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("pullup", 10)] }),
      perf({ byExercise: { pullup: perfEx("pullup", { noData: true }) } }),
    );
    expect(r.plan.exercises[0]!.targetReps).toBe(10);
    expect(r.changes).toHaveLength(0);
  });
});

describe("buildCircuitAdaptation — duration", () => {
  it("недодержал по времени (60→30) снижает цель", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [DUR_EX("plank", 60)] }),
      perf({ byExercise: { plank: perfEx("plank", { medianDurationSec: 30 }) } }),
    );
    expect(r.plan.exercises[0]!.targetDurationSec).toBe(30);
  });
});

describe("buildCircuitAdaptation — раунды и отдых", () => {
  it("неполные круги (5 план, осилил 3) → меньше кругов", () => {
    const r = buildCircuitAdaptation(
      plan({ totalRounds: 5 }),
      perf({ roundsCompleted: 3 }),
    );
    expect(r.plan.totalRounds).toBe(3);
    expect(r.changes).toContainEqual({ type: "rounds", from: 5, to: 3 });
  });

  it("все круги + лёгкий RPE → +1 круг", () => {
    const r = buildCircuitAdaptation(
      plan({ totalRounds: 4 }),
      perf({ roundsCompleted: 4, medianRpe: 6 }),
    );
    expect(r.plan.totalRounds).toBe(5);
  });

  it("тяжёлый RPE → больше отдыха между кругами и упражнениями", () => {
    const r = buildCircuitAdaptation(
      plan({ restBetweenRoundsSec: 60, restBetweenExercisesSec: 15 }),
      perf({ medianRpe: 9 }),
    );
    expect(r.plan.restBetweenRoundsSec).toBe(80);
    expect(r.plan.restBetweenExercisesSec).toBe(25);
  });

  it("лёгкий RPE + все круги → меньше отдыха", () => {
    const r = buildCircuitAdaptation(
      plan({ totalRounds: 4, restBetweenRoundsSec: 60 }),
      perf({ roundsCompleted: 4, medianRpe: 6 }),
    );
    expect(r.plan.restBetweenRoundsSec).toBe(50);
  });

  it("нет RPE → отдых и круги не трогаем (кроме недобора кругов)", () => {
    const r = buildCircuitAdaptation(
      plan({ totalRounds: 4, restBetweenRoundsSec: 60 }),
      perf({ roundsCompleted: 4, medianRpe: null }),
    );
    expect(r.plan.restBetweenRoundsSec).toBe(60);
    expect(r.plan.totalRounds).toBe(4);
  });
});

describe("buildCircuitAdaptation — вес", () => {
  it("попал + лёгкий RPE → +2.5 кг", () => {
    const r = buildCircuitAdaptation(
      plan({ exercises: [REPS_EX("goblet", 12, 20)] }),
      perf({
        medianRpe: 6,
        byExercise: {
          goblet: perfEx("goblet", { medianReps: 12, medianWeightKg: 20 }),
        },
      }),
    );
    expect(r.plan.exercises[0]!.targetWeightKg).toBe(22.5);
  });
});

describe("freshSwapTarget", () => {
  it("reps → 10 повт., без веса", () =>
    expect(freshSwapTarget("reps")).toEqual({
      targetReps: 10,
      targetDurationSec: null,
      targetWeightKg: null,
    }));
  it("duration → 30 сек", () =>
    expect(freshSwapTarget("duration")).toEqual({
      targetReps: null,
      targetDurationSec: 30,
      targetWeightKg: null,
    }));
});
