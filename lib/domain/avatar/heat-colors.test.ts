import { describe, expect, it } from "vitest";

import { avatarHeatColors } from "./heat-colors";
import { heatColorStop, MUSCLE_KEYS } from "./heat";

const NEUTRAL = heatColorStop(0);

describe("avatarHeatColors", () => {
  it("maps each of 14 groups to its precomputed color", () => {
    const data = MUSCLE_KEYS.map((key, i) => ({
      key,
      color: `#0000${(10 + i).toString(16)}`,
    }));
    const out = avatarHeatColors(data);
    expect(Object.keys(out).sort()).toEqual([...MUSCLE_KEYS].sort());
    for (const { key, color } of data) {
      expect(out[key]).toBe(color);
    }
  });

  it("falls back to neutral for a missing group (fail-soft R-10)", () => {
    const data = [{ key: "chest", color: "#e50a46" }];
    const out = avatarHeatColors(data);
    expect(out.chest).toBe("#e50a46");
    expect(out.quads).toBe(NEUTRAL); // отсутствует в data → серый
  });

  it("returns all-neutral for empty data (R-37 cold body, not blank)", () => {
    const out = avatarHeatColors([]);
    expect(Object.keys(out)).toHaveLength(MUSCLE_KEYS.length);
    for (const key of MUSCLE_KEYS) expect(out[key]).toBe(NEUTRAL);
  });

  it("ignores unknown keys (output strictly keyed on MUSCLE_KEYS)", () => {
    const data = [
      { key: "chest", color: "#e50a46" },
      { key: "bogus", color: "#ffffff" },
    ];
    const out = avatarHeatColors(data);
    expect(out).not.toHaveProperty("bogus");
    expect(out.chest).toBe("#e50a46");
  });
});
