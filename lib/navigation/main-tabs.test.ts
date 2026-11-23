import { describe, expect, it } from "vitest";
import { mainTabIndex, rootTabIndex, swipeTarget } from "./main-tabs";

describe("section navigation", () => {
  it("uses the same section for nested routes without matching unrelated prefixes", () => {
    expect(mainTabIndex("/workouts/active-id")).toBe(1);
    expect(mainTabIndex("/library/article")).toBe(1);
    expect(mainTabIndex("/billing")).toBe(3);
    expect(mainTabIndex("/stats-old")).toBe(-1);
    expect(rootTabIndex("/workouts/active-id")).toBe(-1);
  });
  it("accepts deliberate drags and quick horizontal flicks in either direction", () => {
    expect(swipeTarget(0, -90, 8, 500, 390)).toBe(1);
    expect(swipeTarget(2, 80, 8, 500, 390)).toBe(1);
    expect(swipeTarget(1, -35, 3, 50, 390)).toBe(2);
  });
  it("rejects short movements, vertical scrolling and out-of-range gestures", () => {
    expect(swipeTarget(0, -35, 3, 500, 390)).toBeNull();
    expect(swipeTarget(1, -90, 100, 120, 390)).toBeNull();
    expect(swipeTarget(0, 90, 0, 120, 390)).toBeNull();
    expect(swipeTarget(3, -90, 0, 120, 390)).toBeNull();
  });
});
