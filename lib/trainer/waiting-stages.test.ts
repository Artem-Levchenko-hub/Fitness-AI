import { describe, expect, it } from "vitest";

import {
  WAITING_STAGES,
  activeStageIndex,
  stageStates,
} from "@/lib/trainer/waiting-stages";

describe("activeStageIndex", () => {
  it("стартует с первой стадии в нулевой момент", () => {
    expect(activeStageIndex(0)).toBe(0);
  });

  it("держит первую стадию до её порога", () => {
    expect(activeStageIndex(3999)).toBe(0);
  });

  it("переходит на вторую стадию на её пороге", () => {
    expect(activeStageIndex(4000)).toBe(1);
  });

  it("держит вторую стадию до порога третьей", () => {
    expect(activeStageIndex(8999)).toBe(1);
  });

  it("переходит на последнюю стадию на её пороге", () => {
    expect(activeStageIndex(9000)).toBe(2);
  });

  it("залипает на последней стадии при сколь угодно долгом ожидании (честно: разбор может идти дольше косметической ленты)", () => {
    expect(activeStageIndex(120_000)).toBe(WAITING_STAGES.length - 1);
  });

  it("отрицательный/невалидный elapsed трактует как старт", () => {
    expect(activeStageIndex(-100)).toBe(0);
  });
});

describe("stageStates", () => {
  it("в нулевой момент: первая active, остальные pending", () => {
    expect(stageStates(0)).toEqual(["active", "pending", "pending"]);
  });

  it("середина: пройденные done, текущая active, будущие pending", () => {
    expect(stageStates(4000)).toEqual(["done", "active", "pending"]);
  });

  it("последняя стадия active, предыдущие done — НИКОГДА не all-done (нет ложного «готово»)", () => {
    expect(stageStates(9000)).toEqual(["done", "done", "active"]);
    expect(stageStates(999_999)).toEqual(["done", "done", "active"]);
  });

  it("длина массива состояний = числу стадий", () => {
    expect(stageStates(0)).toHaveLength(WAITING_STAGES.length);
  });
});
