import { describe, expect, it } from "vitest";

import {
  HEAT_BUCKET_ORDER,
  groupByHeatBucket,
  heatBucket,
  heatBucketLabel,
} from "./heat-buckets";
import type { HeatLevel } from "./heat";

// Свёртка пяти уровней нагрева в три корзины легенды-чипов: перегруз (peak) /
// в работе (low|normal|high) / недогрет (dormant). Производное от HeatLevel, не
// пересчёт подходов.

describe("heatBucket", () => {
  it("peak → overload", () => {
    expect(heatBucket("peak")).toBe("overload");
  });

  it("dormant → cold", () => {
    expect(heatBucket("dormant")).toBe("cold");
  });

  it("low/normal/high → working", () => {
    expect(heatBucket("low")).toBe("working");
    expect(heatBucket("normal")).toBe("working");
    expect(heatBucket("high")).toBe("working");
  });
});

describe("HEAT_BUCKET_ORDER", () => {
  it("перегруз → в работе → недогрет", () => {
    expect(HEAT_BUCKET_ORDER).toEqual(["overload", "working", "cold"]);
  });
});

describe("heatBucketLabel", () => {
  it("перегруз помечен порогом 15+ (подпись-политика)", () => {
    expect(heatBucketLabel("overload")).toContain("15");
    expect(heatBucketLabel("working")).toBe("В работе");
    expect(heatBucketLabel("cold")).toBe("Недогрет");
  });
});

describe("groupByHeatBucket", () => {
  const m = (key: string, level: HeatLevel) => ({ key, level });

  it("раскладывает группы по корзинам в каноническом порядке", () => {
    const groups = groupByHeatBucket([
      m("quads", "low"),
      m("chest", "peak"),
      m("calves", "dormant"),
    ]);
    expect(groups.map((g) => g.bucket)).toEqual(["overload", "working", "cold"]);
    expect(groups[0]!.items.map((i) => i.key)).toEqual(["chest"]);
    expect(groups[1]!.items.map((i) => i.key)).toEqual(["quads"]);
    expect(groups[2]!.items.map((i) => i.key)).toEqual(["calves"]);
  });

  it("опускает пустые корзины", () => {
    const groups = groupByHeatBucket([m("chest", "peak"), m("back", "high")]);
    expect(groups.map((g) => g.bucket)).toEqual(["overload", "working"]);
    expect(groups.some((g) => g.bucket === "cold")).toBe(false);
  });

  it("сохраняет порядок элементов внутри корзины", () => {
    const groups = groupByHeatBucket([
      m("a", "normal"),
      m("b", "high"),
      m("c", "low"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((i) => i.key)).toEqual(["a", "b", "c"]);
  });

  it("несёт человекочитаемый ярлык корзины", () => {
    const groups = groupByHeatBucket([m("chest", "peak")]);
    expect(groups[0]!.label).toBe(heatBucketLabel("overload"));
  });

  it("пустой вход → пустой результат", () => {
    expect(groupByHeatBucket([])).toEqual([]);
  });
});
