import { describe, expect, it } from "vitest";

import { templateInputSchema } from "./templates";

const exerciseId = "00000000-0000-4000-8000-000000000001";

function item(overrides: Record<string, unknown> = {}) {
  return {
    exerciseId,
    targetSets: 3,
    targetRepsMin: 12,
    targetRepsMax: 20,
    targetWeightKg: 20,
    targetRestSeconds: 120,
    notes: "",
    ...overrides,
  };
}

describe("templateInputSchema Myo-reps", () => {
  it("uses the 3 mini / 30 second defaults", () => {
    const parsed = templateInputSchema.parse({
      name: "Myo day",
      items: [item({ myoReps: true })],
    });

    expect(parsed.items[0]).toMatchObject({
      myoReps: true,
      myoMiniSets: 3,
      myoMiniRestSeconds: 30,
    });
  });

  it("keeps legacy template payloads valid with Myo-reps disabled", () => {
    const parsed = templateInputSchema.parse({
      name: "Classic day",
      items: [item()],
    });

    expect(parsed.items[0].myoReps).toBe(false);
  });
});
