import { describe, expect, it } from "vitest";

import { buildStatsOverview } from "./overview";

describe("buildStatsOverview", () => {
  it("не выдаёт объём за прогресс при отсутствии сравнимого упражнения", () => {
    const result = buildStatsOverview({
      workouts: 7,
      totalSets: 10,
      totalReps: 92,
      strengthInsight: null,
    });

    expect(result.headline).toContain("7");
    expect(result.detail).toContain("10");
    expect(result.nextStep).toMatch(/сравнение силы/i);
    expect(`${result.headline} ${result.detail}`).not.toMatch(
      /растёшь|прогрессируешь/i,
    );
  });

  it("при нулевой истории объясняет, какие данные нужны", () => {
    const result = buildStatsOverview({
      workouts: 0,
      totalSets: 0,
      totalReps: 0,
      strengthInsight: null,
    });

    expect(result.headline).toMatch(/недостаточно данных/i);
    expect(result.nextStep).toMatch(/две сопоставимые сессии/i);
  });

  it("при наличии силового тренда ведёт им, а не тоннажем", () => {
    const result = buildStatsOverview({
      workouts: 8,
      totalSets: 32,
      totalReps: 240,
      strengthInsight: {
        status: "improved",
        headline: "Жим лёжа: сила растёт",
        detail: "Оценочный максимум вырос с 90 до 95 кг.",
        pct: 6,
      },
    });

    expect(result.headline).toBe("Жим лёжа: сила растёт");
    expect(result.detail).toContain("90 до 95");
    expect(result.nextStep).toMatch(/техник/i);
  });
});
