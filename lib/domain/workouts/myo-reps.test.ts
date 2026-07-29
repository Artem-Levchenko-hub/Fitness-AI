import { describe, expect, it } from "vitest";

import {
  elapsedRestSeconds,
  myoMiniReps,
  myoRoleForSetIndex,
  myoTotalSets,
} from "./myo-reps";

describe("myo-reps helpers", () => {
  it("считает активационный плюс мини-подходы", () => {
    expect(myoTotalSets(3)).toBe(4);
  });

  it("округляет целевые повторы мини-подхода от активации", () => {
    expect(myoMiniReps(10, 30)).toBe(3);
    expect(myoMiniReps(12, 30)).toBe(4);
  });

  it("помечает первый подход активационным, остальные мини", () => {
    expect(myoRoleForSetIndex(0)).toBe("activation");
    expect(myoRoleForSetIndex(1)).toBe("mini");
    expect(myoRoleForSetIndex(4)).toBe("mini");
  });

  it("считает фактический отдых и ограничивает серверным максимумом", () => {
    const startedAt = new Date("2026-07-27T10:00:00.000Z");
    expect(
      elapsedRestSeconds(startedAt, Date.parse("2026-07-27T10:00:30.000Z")),
    ).toBe(30);
    expect(
      elapsedRestSeconds(startedAt, Date.parse("2026-07-27T12:00:00.000Z")),
    ).toBe(3600);
    expect(elapsedRestSeconds(null)).toBeNull();
  });
});
