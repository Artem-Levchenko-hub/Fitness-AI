import { describe, expect, it } from "vitest";

import {
  analyzeTemplateTrends,
  type TrendSession,
  type TrendTemplateItem,
} from "./trend-analyzer";

const item: TrendTemplateItem = {
  exerciseId: "bench",
  position: 0,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: 60,
  targetRestSeconds: 120,
  setScheme: "straight",
};

function sessions(opts: {
  count?: number;
  reps?: number;
  rpe?: number;
  feeling?: TrendSession["feeling"];
  rest?: number;
} = {}): TrendSession[] {
  return Array.from({ length: opts.count ?? 10 }, (_, index) => ({
    id: `w-${index}`,
    startedAt: new Date(Date.UTC(2026, 6, 20 - index)),
    feeling: opts.feeling ?? "normal",
    exercises: [
      {
        exerciseId: "bench",
        sets: Array.from({ length: 3 }, () => ({
          weightKg: 60,
          reps: opts.reps ?? 12,
          rpe: opts.rpe ?? 8,
          restSeconds: opts.rest ?? 120,
          setType: "working",
        })),
      },
    ],
  }));
}

describe("analyzeTemplateTrends", () => {
  it("не меняет шаблон до десяти релевантных сессий", () => {
    const result = analyzeTemplateTrends({
      current: [item],
      sessions: sessions({ count: 9 }),
      life: { sleepHours: [], sleepQuality: [], nutritionDays: 0, averageCalories: null },
    });
    expect(result.eligible).toBe(false);
    expect(result.items).toEqual([item]);
  });

  it("делает только малый шаг веса при устойчивом результате и умеренном RPE", () => {
    const result = analyzeTemplateTrends({
      current: [item],
      sessions: sessions(),
      life: {
        sleepHours: [7.5, 8, 7],
        sleepQuality: [4, 4, 3],
        nutritionDays: 5,
        averageCalories: 2500,
      },
    });
    expect(result.overloadRisk).toBe(false);
    expect(result.items[0]?.targetWeightKg).toBe(62.5);
    expect(result.requiresConfirmation).toBe(false);
  });

  it("при признаках перегрузки предлагает deload и требует подтверждение", () => {
    const declining = sessions({ rpe: 9.5, feeling: "hard" }).map(
      (session, index) => ({
        ...session,
        exercises: session.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({
            ...set,
            reps: index < 5 ? 8 : 12,
          })),
        })),
      }),
    );
    const result = analyzeTemplateTrends({
      current: [item],
      sessions: declining,
      life: {
        sleepHours: [5.5, 5.8, 5.9],
        sleepQuality: [2, 2, 2],
        nutritionDays: 0,
        averageCalories: null,
      },
    });
    expect(result.overloadRisk).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.items[0]?.targetSets).toBe(2);
    expect(result.items[0]?.targetWeightKg).toBe(57);
  });
});
