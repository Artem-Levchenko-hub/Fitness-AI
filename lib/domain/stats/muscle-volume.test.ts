import { describe, expect, it } from "vitest";

import { foldMuscleVolume, roleFactor, type MuscleVolumeRow } from "./muscle-volume";

describe("roleFactor", () => {
  it("weights primary fully and secondary by half", () => {
    expect(roleFactor("primary")).toBe(1);
    expect(roleFactor("secondary")).toBe(0.5);
  });
});

describe("foldMuscleVolume", () => {
  it("returns [] for no rows", () => {
    expect(foldMuscleVolume([])).toEqual([]);
  });

  it("applies role-fold (primary 1.0 / secondary 0.5)", () => {
    const rows: MuscleVolumeRow[] = [
      { muscleKey: "chest", role: "primary", volume: 1000 },
      { muscleKey: "triceps", role: "secondary", volume: 1000 },
    ];
    expect(foldMuscleVolume(rows)).toEqual([
      { muscleKey: "chest", volume: 1000 },
      { muscleKey: "triceps", volume: 500 },
    ]);
  });

  it("sums strength + circuit contributions to the same muscle/role", () => {
    // Силовые primary 800 + круговые primary 200 на ту же грудь = 1000.
    const rows: MuscleVolumeRow[] = [
      { muscleKey: "chest", role: "primary", volume: 800 },
      { muscleKey: "chest", role: "primary", volume: 200 },
    ];
    expect(foldMuscleVolume(rows)).toEqual([{ muscleKey: "chest", volume: 1000 }]);
  });

  it("sorts by folded volume descending", () => {
    const rows: MuscleVolumeRow[] = [
      { muscleKey: "back_lats", role: "primary", volume: 300 },
      { muscleKey: "quads", role: "primary", volume: 900 },
      { muscleKey: "chest", role: "primary", volume: 600 },
    ];
    expect(foldMuscleVolume(rows).map((m) => m.muscleKey)).toEqual([
      "quads",
      "chest",
      "back_lats",
    ]);
  });
});
