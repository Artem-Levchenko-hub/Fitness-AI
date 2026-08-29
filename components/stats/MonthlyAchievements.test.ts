import { describe, expect, it } from "vitest";

import { formatTonnageAchievementValue } from "./MonthlyAchievements";

describe("formatTonnageAchievementValue", () => {
  it("never rounds a current value up to an achievement threshold", () => {
    expect(formatTonnageAchievementValue(0.999)).toBe("0,99");
    expect(formatTonnageAchievementValue(99.999)).toBe("99,99");
    expect(formatTonnageAchievementValue(100)).toBe("100");
  });
});
