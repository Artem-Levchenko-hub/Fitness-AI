import { describe, expect, it } from "vitest";

import { frequencyGoalView } from "./frequency-goal";

describe("frequencyGoalView", () => {
  it("below target: current set, no fabricated pace (single point)", () => {
    const v = frequencyGoalView(8, 12);
    expect(v.current).toBe(8);
    expect(v.target).toBe(12);
    expect(v.reached).toBe(false);
    expect(v.pct).toBeCloseTo(8 / 12, 5);
    // одна точка ⇒ темпа нет ⇒ ETA не выдумывается
    expect(v.etaWeeks).toBeNull();
  });

  it("at target ⇒ reached, full bar", () => {
    const v = frequencyGoalView(12, 12);
    expect(v.reached).toBe(true);
    expect(v.pct).toBe(1);
  });

  it("over target ⇒ reached, pct clamped to 1", () => {
    const v = frequencyGoalView(15, 12);
    expect(v.reached).toBe(true);
    expect(v.pct).toBe(1);
  });

  it("zero weekly sets ⇒ honest 0, not 'no history'", () => {
    const v = frequencyGoalView(0, 10);
    expect(v.current).toBe(0);
    expect(v.pct).toBe(0);
    expect(v.reached).toBe(false);
    expect(v.etaWeeks).toBeNull();
  });

  it("non-positive target ⇒ pct guarded to 0", () => {
    const v = frequencyGoalView(5, 0);
    expect(v.pct).toBe(0);
  });
});
