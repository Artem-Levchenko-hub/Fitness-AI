import { describe, expect, it } from "vitest";

import {
  allDemoGifs,
  EXERCISE_DEMOS,
  getExerciseDemo,
  hasExerciseDemo,
  pickRandomDemoGif,
} from "./demos";

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

describe("allDemoGifs", () => {
  it("returns every demo gif path, one per manifest entry", () => {
    const gifs = allDemoGifs();
    expect(gifs.length).toBe(Object.keys(EXERCISE_DEMOS).length);
    expect(gifs.every((g) => g.startsWith("/exercises-demos/"))).toBe(true);
  });

  it("is ordered by slug (stable for reproducible random pick)", () => {
    const expected = Object.keys(EXERCISE_DEMOS)
      .sort()
      .map((slug) => `/exercises-demos/${slug}.gif`);
    expect(allDemoGifs()).toEqual(expected);
  });
});

describe("pickRandomDemoGif", () => {
  it("rand=0 picks the first gif, rand→1 picks the last", () => {
    const gifs = allDemoGifs();
    expect(pickRandomDemoGif(() => 0)).toBe(gifs[0]);
    expect(pickRandomDemoGif(() => 0.999999)).toBe(gifs[gifs.length - 1]);
  });

  it("rand=1 stays in-bounds (last gif, never undefined)", () => {
    const gifs = allDemoGifs();
    expect(pickRandomDemoGif(() => 1)).toBe(gifs[gifs.length - 1]);
  });

  it("always returns a path that exists in the manifest", () => {
    const set = new Set(allDemoGifs());
    for (const r of [0, 0.1, 0.37, 0.5, 0.84, 0.999]) {
      expect(set.has(pickRandomDemoGif(() => r)!)).toBe(true);
    }
  });
});
