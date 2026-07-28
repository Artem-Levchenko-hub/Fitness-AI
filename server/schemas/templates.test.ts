import { describe, expect, it } from "vitest";

import { templateInputSchema } from "./templates";

const exerciseId = "00000000-0000-4000-8000-000000000001";

function item(overrides: Record<string, unknown> = {}) {
  return {
    exerciseId,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetWeightKg: 20,
    targetRestSeconds: 120,
    notes: "",
    ...overrides,
  };
}

describe("templateInputSchema myo-reps", () => {
  it("normalizes target sets to activation plus mini-sets", () => {
    const parsed = templateInputSchema.parse({
      name: "Myo day",
      items: [
        item({
          setScheme: "myo_reps",
          myoMiniSets: 3,
          myoRepsPercent: 30,
          myoRestSeconds: 30,
        }),
      ],
    });

    expect(parsed.items[0]).toMatchObject({
      setScheme: "myo_reps",
      targetSets: 4,
      myoMiniSets: 3,
      myoRepsPercent: 30,
      myoRestSeconds: 30,
    });
  });

  it("keeps old template payloads compatible as straight sets", () => {
    const parsed = templateInputSchema.parse({
      name: "Classic day",
      items: [item()],
    });

    expect(parsed.items[0]).toMatchObject({
      setScheme: "straight",
      targetSets: 3,
    });
  });
});
