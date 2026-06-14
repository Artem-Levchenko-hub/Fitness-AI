import { describe, expect, it } from "vitest";

import { mergeVolumeBuckets, type VolumeBucket } from "./volume-merge";

describe("mergeVolumeBuckets", () => {
  it("returns [] for no sources / all empty", () => {
    expect(mergeVolumeBuckets([])).toEqual([]);
    expect(mergeVolumeBuckets([[], []])).toEqual([]);
  });

  it("passes a single source through, sorted by key asc", () => {
    const strength: VolumeBucket[] = [
      { key: "2026-06-10", volume: 1000, sets: 6, reps: 60 },
      { key: "2026-06-08", volume: 500, sets: 3, reps: 30 },
    ];
    expect(mergeVolumeBuckets([strength])).toEqual([
      { key: "2026-06-08", volume: 500, sets: 3, reps: 30 },
      { key: "2026-06-10", volume: 1000, sets: 6, reps: 60 },
    ]);
  });

  it("sums strength + circuit on the same day (circuit adds sets/reps, bodyweight adds 0 volume)", () => {
    const strength: VolumeBucket[] = [
      { key: "2026-06-09", volume: 2400, sets: 12, reps: 96 },
    ];
    // Bodyweight круговая в тот же день: подходы и повторы есть, тоннаж 0.
    const circuit: VolumeBucket[] = [
      { key: "2026-06-09", volume: 0, sets: 9, reps: 135 },
    ];
    expect(mergeVolumeBuckets([strength, circuit])).toEqual([
      { key: "2026-06-09", volume: 2400, sets: 21, reps: 231 },
    ]);
  });

  it("merges distinct days and circuit-only days into the series", () => {
    const strength: VolumeBucket[] = [
      { key: "2026-06-09", volume: 1000, sets: 5, reps: 50 },
    ];
    const circuit: VolumeBucket[] = [
      { key: "2026-06-11", volume: 200, sets: 6, reps: 60 },
    ];
    expect(mergeVolumeBuckets([strength, circuit])).toEqual([
      { key: "2026-06-09", volume: 1000, sets: 5, reps: 50 },
      { key: "2026-06-11", volume: 200, sets: 6, reps: 60 },
    ]);
  });

  it("does not mutate the input buckets", () => {
    const a: VolumeBucket[] = [{ key: "2026-06-09", volume: 100, sets: 1, reps: 10 }];
    const b: VolumeBucket[] = [{ key: "2026-06-09", volume: 50, sets: 2, reps: 20 }];
    mergeVolumeBuckets([a, b]);
    expect(a[0]).toEqual({ key: "2026-06-09", volume: 100, sets: 1, reps: 10 });
  });
});
