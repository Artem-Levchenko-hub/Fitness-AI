import { describe, expect, it } from "vitest";

import { EXERCISE_DEMOS, getExerciseDemo, hasExerciseDemo } from "./demos";

describe("getExerciseDemo", () => {
  it("returns the self-hosted gif path for a matched slug", () => {
    const demo = getExerciseDemo("bench-press-barbell");
    expect(demo).not.toBeNull();
    expect(demo?.gif).toBe("/exercises-demos/bench-press-barbell.gif");
  });

  it("resolves an OVERRIDES-matched slug (generic name → equipment-prefixed source)", () => {
    expect(getExerciseDemo("deadlift")?.gif).toBe(
      "/exercises-demos/deadlift.gif",
    );
  });

  it("returns null for an exercise left without a demo", () => {
    // bulgarian-split-squat is one of the 6 with no clean ExerciseDB match.
    expect(getExerciseDemo("bulgarian-split-squat")).toBeNull();
  });

  it("returns null for unknown / empty / nullish slugs", () => {
    expect(getExerciseDemo("does-not-exist")).toBeNull();
    expect(getExerciseDemo("")).toBeNull();
    expect(getExerciseDemo(null)).toBeNull();
    expect(getExerciseDemo(undefined)).toBeNull();
  });

  it("never points a demo at the per-seed UUID — keys are slugs", () => {
    for (const [key, asset] of Object.entries(EXERCISE_DEMOS)) {
      expect(key).toMatch(/^[a-z0-9-]+$/); // slug shape, not a UUID
      expect(asset.gif).toBe(`/exercises-demos/${key}.gif`);
    }
  });
});

describe("hasExerciseDemo", () => {
  it("mirrors getExerciseDemo presence", () => {
    expect(hasExerciseDemo("bench-press-barbell")).toBe(true);
    expect(hasExerciseDemo("bulgarian-split-squat")).toBe(false);
    expect(hasExerciseDemo(null)).toBe(false);
  });

  it("covers a solid majority of the system catalogue", () => {
    // Guards against a botched re-fetch silently emptying the manifest.
    expect(Object.keys(EXERCISE_DEMOS).length).toBeGreaterThanOrEqual(60);
  });
});
