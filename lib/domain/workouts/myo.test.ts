import { describe, expect, it } from "vitest";

import {
  myoPhaseLabel,
  plannedSetCount,
  repsTargetForNextSet,
  restBeforeNextSet,
  type MyoProtocol,
} from "./myo";

const OFF: MyoProtocol = {
  myoReps: false,
  myoMiniSets: 4,
  myoMiniReps: 4,
  myoMiniRestSeconds: 15,
};

const ON: MyoProtocol = { ...OFF, myoReps: true };

describe("plannedSetCount", () => {
  it("обычный режим — targetSets как есть", () => {
    expect(plannedSetCount(3, OFF)).toBe(3);
  });

  it("миорепсы — активационный + мини-сеты", () => {
    expect(plannedSetCount(3, ON)).toBe(5); // 1 + 4, targetSets игнорируется
  });

  it("вырожденный конфиг (0 мини) — минимум 1 мини", () => {
    expect(plannedSetCount(3, { ...ON, myoMiniSets: 0 })).toBe(2);
  });
});

describe("restBeforeNextSet", () => {
  it("до первого подхода — целевой отдых даже в миорепсах", () => {
    expect(restBeforeNextSet(120, ON, 0)).toBe(120);
  });

  it("после активационного — мини-отдых", () => {
    expect(restBeforeNextSet(120, ON, 1)).toBe(15);
    expect(restBeforeNextSet(120, ON, 3)).toBe(15);
  });

  it("обычный режим — всегда целевой", () => {
    expect(restBeforeNextSet(120, OFF, 2)).toBe(120);
  });
});

describe("repsTargetForNextSet", () => {
  it("активационный — диапазон шаблона", () => {
    expect(repsTargetForNextSet(12, 20, ON, 0)).toEqual({ min: 12, max: 20 });
  });

  it("мини-сет — фиксированные myoMiniReps", () => {
    expect(repsTargetForNextSet(12, 20, ON, 1)).toEqual({ min: 4, max: 4 });
  });

  it("обычный режим — диапазон шаблона всегда", () => {
    expect(repsTargetForNextSet(8, 12, OFF, 2)).toEqual({ min: 8, max: 12 });
  });
});

describe("myoPhaseLabel", () => {
  it("выключено — null", () => {
    expect(myoPhaseLabel(OFF, 0)).toBeNull();
  });

  it("следующий — активационный", () => {
    expect(myoPhaseLabel(ON, 0)).toBe("активационный");
  });

  it("следующий — мини K/N", () => {
    expect(myoPhaseLabel(ON, 1)).toBe("мини 1/4");
    expect(myoPhaseLabel(ON, 4)).toBe("мини 4/4");
  });
});
