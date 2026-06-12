import { describe, expect, it } from "vitest";

import { activeRegionCount, buildBodyMap, type RegionHeat } from "./body-map";
import { heatColorStop, MUSCLE_KEYS } from "./heat";

const DORMANT = heatColorStop(0);

/** Мини-карта мышц дашборда (H9.2): полный 14-региональный силуэт из нагрева. */
describe("buildBodyMap", () => {
  it("пусто → все 14 групп, все серые-dormant, ни одна не активна", () => {
    const regions = buildBodyMap([]);
    expect(regions).toHaveLength(MUSCLE_KEYS.length);
    expect(regions.every((r) => r.color === DORMANT)).toBe(true);
    expect(regions.every((r) => !r.active && r.level === "dormant")).toBe(true);
    expect(activeRegionCount(regions)).toBe(0);
  });

  it("сохраняет канонический порядок MUSCLE_KEYS", () => {
    const regions = buildBodyMap([]);
    expect(regions.map((r) => r.key)).toEqual([...MUSCLE_KEYS]);
  });

  it("частичные данные: присутствующая группа окрашена+активна, отсутствующая — серая", () => {
    const input: RegionHeat[] = [
      { key: "chest", color: "#e50a46", level: "peak", sets: 16 },
    ];
    const regions = buildBodyMap(input);
    const chest = regions.find((r) => r.key === "chest")!;
    const lats = regions.find((r) => r.key === "back_lats")!;

    expect(chest.color).toBe("#e50a46");
    expect(chest.active).toBe(true);
    expect(chest.level).toBe("peak");

    expect(lats.color).toBe(DORMANT);
    expect(lats.active).toBe(false);
    expect(lats.level).toBe("dormant");
  });

  it("группа с sets=0 во входе считается неактивной", () => {
    const regions = buildBodyMap([
      { key: "quads", color: DORMANT, level: "dormant", sets: 0 },
    ]);
    expect(regions.find((r) => r.key === "quads")!.active).toBe(false);
  });

  it("регионы несут RU-ярлык группы", () => {
    const regions = buildBodyMap([]);
    expect(regions.find((r) => r.key === "chest")!.label).toBe("Грудь");
    expect(regions.find((r) => r.key === "calves")!.label).toBe("Икры");
  });

  it("неизвестные ключи во входе игнорируются — набор всегда ровно 14 канонических", () => {
    const regions = buildBodyMap([
      { key: "totally_unknown", color: "#fff", level: "peak", sets: 9 },
    ]);
    expect(regions).toHaveLength(MUSCLE_KEYS.length);
    expect(regions.some((r) => (r.key as string) === "totally_unknown")).toBe(
      false,
    );
  });
});

describe("activeRegionCount", () => {
  it("считает только активные (sets>0) группы", () => {
    const regions = buildBodyMap([
      { key: "chest", color: "#e50a46", level: "peak", sets: 16 },
      { key: "quads", color: "#f2731e", level: "high", sets: 11 },
      { key: "biceps", color: DORMANT, level: "dormant", sets: 0 },
    ]);
    expect(activeRegionCount(regions)).toBe(2);
  });
});
