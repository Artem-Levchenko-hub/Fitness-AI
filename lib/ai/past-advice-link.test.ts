import { describe, expect, it } from "vitest";

import { resolvePastAdviceHref } from "./past-advice-link";

describe("resolvePastAdviceHref (H13.5)", () => {
  it("нет предшественника (первый разбор) → null (статика, R-37)", () => {
    expect(resolvePastAdviceHref(null)).toBeNull();
  });

  it("силовой предшественник → /workouts/<id>/trainer", () => {
    expect(
      resolvePastAdviceHref({ workoutId: "w1", circuitWorkoutId: null }),
    ).toBe("/workouts/w1/trainer");
  });

  it("круговой предшественник → /circuits/<id>", () => {
    expect(
      resolvePastAdviceHref({ workoutId: null, circuitWorkoutId: "c1" }),
    ).toBe("/circuits/c1");
  });

  it("digest/weekly (оба FK null) → null (некуда вести)", () => {
    expect(
      resolvePastAdviceHref({ workoutId: null, circuitWorkoutId: null }),
    ).toBeNull();
  });

  it("оба FK заполнены → приоритет круговой (/circuits)", () => {
    expect(
      resolvePastAdviceHref({ workoutId: "w1", circuitWorkoutId: "c1" }),
    ).toBe("/circuits/c1");
  });
});
