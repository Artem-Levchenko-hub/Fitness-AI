import { describe, expect, it } from "vitest";
import { mainTabIndex, rootTabIndex, swipeOffset, swipeTarget } from "./main-tabs";

describe("section navigation", () => {
  it("uses the same section for nested routes without matching unrelated prefixes", () => {
    expect(mainTabIndex("/workouts/active-id")).toBe(1);
    expect(mainTabIndex("/library/article")).toBe(1);
    expect(mainTabIndex("/billing")).toBe(3);
    expect(mainTabIndex("/stats-old")).toBe(-1);
    expect(rootTabIndex("/workouts/active-id")).toBe(-1);
  });
  it("accepts deliberate drags and quick horizontal flicks in either direction", () => {
    expect(swipeTarget(0, -90, 8, 390)).toBe(1);
    expect(swipeTarget(2, 80, 8, 390)).toBe(1);
    expect(swipeTarget(1, -35, 3, 390, -0.7)).toBe(2);
  });
  it("rejects short movements, vertical scrolling and out-of-range gestures", () => {
    expect(swipeTarget(0, -35, 3, 390)).toBeNull();
    expect(swipeTarget(1, -90, 100, 390, -1)).toBeNull();
    expect(swipeTarget(0, 90, 0, 390)).toBeNull();
    expect(swipeTarget(3, -90, 0, 390)).toBeNull();
  });

  it("honors a reversal near release and rejects a tiny fast movement", () => {
    expect(swipeTarget(1, -84, 4, 390, 0.7)).toBeNull();
    expect(swipeTarget(1, -14, 3, 390, -2)).toBeNull();
  });

  it("follows the finger until resistance takes over and stops at the ends", () => {
    expect(swipeOffset(-90, 390, true)).toBe(-90);
    expect(swipeOffset(-250, 390, true)).toBeLessThan(-90);
    expect(swipeOffset(-250, 390, true)).toBeGreaterThan(-195);
    expect(swipeOffset(90, 390, false)).toBeGreaterThan(0);
    expect(swipeOffset(90, 390, false)).toBeLessThan(20);
  });
});
