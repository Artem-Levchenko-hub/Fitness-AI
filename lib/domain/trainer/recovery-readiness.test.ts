import { describe, expect, it } from "vitest";

import { assessTrainingReadiness } from "./recovery-readiness";

describe("assessTrainingReadiness", () => {
  it("blocks automatic progression after poor sleep", () => {
    expect(
      assessTrainingReadiness({
        sleepHours: 6,
        sleepQuality: 4,
        proteinG: 140,
        bodyWeightKg: 80,
      }),
    ).toBe("caution");
  });

  it("blocks automatic progression when known protein is too low", () => {
    expect(
      assessTrainingReadiness({
        sleepHours: 8,
        sleepQuality: 4,
        proteinG: 70,
        bodyWeightKg: 80,
      }),
    ).toBe("caution");
  });

  it("does not invent a recovery conclusion without fresh data", () => {
    expect(
      assessTrainingReadiness({
        sleepHours: null,
        sleepQuality: null,
        proteinG: null,
        bodyWeightKg: null,
      }),
    ).toBe("unknown");
  });
});
