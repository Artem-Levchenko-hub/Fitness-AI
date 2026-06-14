import { describe, expect, it } from "vitest";

import { heatColorStop, MUSCLE_KEYS } from "./heat";
import { volumeHeatColors } from "./volume-heat";

describe("volumeHeatColors", () => {
  it("returns a color for every one of the 14 groups", () => {
    const colors = volumeHeatColors([{ muscleKey: "chest", volume: 100 }]);
    for (const key of MUSCLE_KEYS) {
      expect(typeof colors[key]).toBe("string");
    }
    expect(Object.keys(colors)).toHaveLength(MUSCLE_KEYS.length);
  });

  it("empty data → every group dormant grey (t=0)", () => {
    const colors = volumeHeatColors([]);
    const grey = heatColorStop(0);
    for (const key of MUSCLE_KEYS) {
      expect(colors[key]).toBe(grey);
    }
  });

  it("the max-volume group is fully heated (t=1)", () => {
    const colors = volumeHeatColors([
      { muscleKey: "chest", volume: 1000 },
      { muscleKey: "quads", volume: 250 },
    ]);
    expect(colors.chest).toBe(heatColorStop(1));
  });

  it("colors are monotonic with volume against the set max", () => {
    const colors = volumeHeatColors([
      { muscleKey: "chest", volume: 1000 },
      { muscleKey: "quads", volume: 500 },
      { muscleKey: "calves", volume: 100 },
    ]);
    // chest=t1, quads=t0.5, calves=t0.1 — each must equal the ramp stop for its
    // normalized t (same max basis as the bar pct → bar and silhouette agree).
    expect(colors.chest).toBe(heatColorStop(1));
    expect(colors.quads).toBe(heatColorStop(0.5));
    expect(colors.calves).toBe(heatColorStop(0.1));
  });

  it("groups absent from data → dormant grey, not undefined", () => {
    const colors = volumeHeatColors([{ muscleKey: "chest", volume: 500 }]);
    expect(colors.quads).toBe(heatColorStop(0));
    expect(colors.back_lats).toBe(heatColorStop(0));
  });

  it("ignores zero / negative volume (treated as dormant)", () => {
    const colors = volumeHeatColors([
      { muscleKey: "chest", volume: 0 },
      { muscleKey: "quads", volume: -10 },
      { muscleKey: "biceps", volume: 300 },
    ]);
    // only biceps has real volume → it is the max → fully heated.
    expect(colors.biceps).toBe(heatColorStop(1));
    expect(colors.chest).toBe(heatColorStop(0));
    expect(colors.quads).toBe(heatColorStop(0));
  });

  it("ignores unknown muscle keys without throwing", () => {
    const colors = volumeHeatColors([
      { muscleKey: "made_up_group", volume: 9999 },
      { muscleKey: "chest", volume: 200 },
    ]);
    expect(Object.keys(colors)).toHaveLength(MUSCLE_KEYS.length);
    // unknown key did not become the max — chest is the only real group → t=1.
    expect(colors.chest).toBe(heatColorStop(1));
    expect("made_up_group" in colors).toBe(false);
  });
});
