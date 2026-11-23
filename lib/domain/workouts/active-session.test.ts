import { describe, expect, it } from "vitest";

import { AUTO_FINISH_IDLE_MS, isResumable, strengthAutoFinishAt } from "./active-session";

const NOW = new Date("2026-06-12T12:00:00.000Z");

describe("isResumable", () => {
  it("treats a fresh session as resumable", () => {
    const startedAt = new Date("2026-06-12T11:00:00.000Z"); // 1h ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });

  it("treats a session at exactly the cutoff as resumable (inclusive)", () => {
    const startedAt = new Date("2026-06-12T00:00:00.000Z"); // exactly 12h ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });

  it("preserves a session one minute past the former cutoff", () => {
    const startedAt = new Date("2026-06-11T23:59:00.000Z"); // 12h01m ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });

  it("preserves an unfinished session across days", () => {
    const startedAt = new Date("2026-06-11T23:00:00.000Z"); // 13h ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });
});

const exercise = (done = 3) => ({ targetSets: 3, myoReps: false, myoMiniSets: 3, sets: Array.from({ length: done }) });

describe("strengthAutoFinishAt", () => {
  it("waits for every exercise and never finishes an empty workout", () => {
    expect(strengthAutoFinishAt([], NOW)).toBeNull();
    expect(strengthAutoFinishAt([exercise(), exercise(2)], NOW)).toBeNull();
    expect(strengthAutoFinishAt([exercise()], null)).toBeNull();
  });

  it("finishes one hour after the last server save and re-arms after another set", () => {
    expect(AUTO_FINISH_IDLE_MS).toBe(3_600_000);
    expect(strengthAutoFinishAt([exercise()], NOW)?.toISOString()).toBe("2026-06-12T13:00:00.000Z");
    expect(strengthAutoFinishAt([exercise(4)], new Date("2026-06-12T12:30:00Z"))?.toISOString()).toBe("2026-06-12T13:30:00.000Z");
  });

  it("uses activation plus all planned Myo mini sets", () => {
    const myo = { ...exercise(3), targetSets: 2, myoReps: true, myoMiniSets: 3 };
    expect(strengthAutoFinishAt([myo], NOW)).toBeNull();
    expect(strengthAutoFinishAt([{ ...myo, sets: exercise(4).sets }], NOW)).not.toBeNull();
  });
});
