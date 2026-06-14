import { describe, expect, it } from "vitest";

import { distributeRepRanges } from "./rep-ranges";

describe("distributeRepRanges", () => {
  it("returns four zeroed buckets for empty input", () => {
    expect(distributeRepRanges([])).toEqual([
      { bucket: "1-5", sets: 0 },
      { bucket: "6-10", sets: 0 },
      { bucket: "11-15", sets: 0 },
      { bucket: "16+", sets: 0 },
    ]);
  });

  it("classifies boundary values correctly", () => {
    // 5->1-5, 6->6-10, 10->6-10, 11->11-15, 15->11-15, 16->16+
    expect(distributeRepRanges([5, 6, 10, 11, 15, 16])).toEqual([
      { bucket: "1-5", sets: 1 },
      { bucket: "6-10", sets: 2 },
      { bucket: "11-15", sets: 2 },
      { bucket: "16+", sets: 1 },
    ]);
  });

  it("counts circuit reps alongside strength reps (one combined list)", () => {
    // Силовые [8,8,3] + круговые [15,15,20] = распределены вместе.
    const strength = [8, 8, 3];
    const circuit = [15, 15, 20];
    expect(distributeRepRanges([...strength, ...circuit])).toEqual([
      { bucket: "1-5", sets: 1 },
      { bucket: "6-10", sets: 2 },
      { bucket: "11-15", sets: 2 },
      { bucket: "16+", sets: 1 },
    ]);
  });
});
