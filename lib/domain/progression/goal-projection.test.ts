import { describe, expect, it } from "vitest";

import { projectProgress } from "./goal-projection";

describe("projectProgress", () => {
  it("пустая история → все поля undefined (нет точки отсчёта)", () => {
    const p = projectProgress([], 120);
    expect(p.current).toBeUndefined();
    expect(p.deltaSinceStart).toBeUndefined();
    expect(p.paceToTarget).toBeUndefined();
    expect(p.etaWeeks).toBeUndefined();
  });

  it("растущий тренд [100,102,104,106] цель 120 → pace +2/нед, etaWeeks 7", () => {
    const p = projectProgress([100, 102, 104, 106], 120);
    expect(p.current).toBe(106);
    expect(p.deltaSinceStart).toBe(6);
    expect(p.paceToTarget).toBeCloseTo(2, 5);
    expect(p.etaWeeks).toBeCloseTo(7, 5);
  });

  it("цель достигнута (current ≥ target) → etaWeeks 0, темп всё ещё виден", () => {
    const p = projectProgress([100, 125], 120);
    expect(p.current).toBe(125);
    expect(p.current!).toBeGreaterThanOrEqual(120);
    expect(p.deltaSinceStart).toBe(25);
    expect(p.etaWeeks).toBe(0);
  });

  it("застой [100,100,100] → pace undefined, etaWeeks undefined", () => {
    const p = projectProgress([100, 100, 100], 120);
    expect(p.current).toBe(100);
    expect(p.deltaSinceStart).toBe(0);
    expect(p.paceToTarget).toBeUndefined();
    expect(p.etaWeeks).toBeUndefined();
  });

  it("регресс [106,104,100] → pace undefined (avgΔ ≤ 0, защита от Infinity)", () => {
    const p = projectProgress([106, 104, 100], 120);
    expect(p.current).toBe(100);
    expect(p.deltaSinceStart).toBe(-6);
    expect(p.paceToTarget).toBeUndefined();
    expect(p.etaWeeks).toBeUndefined();
  });

  it("одна точка → delta 0, pace/eta undefined (нельзя оценить темп)", () => {
    const p = projectProgress([100], 120);
    expect(p.current).toBe(100);
    expect(p.deltaSinceStart).toBe(0);
    expect(p.paceToTarget).toBeUndefined();
    expect(p.etaWeeks).toBeUndefined();
  });

  it("epsilon гасит микро-рост как застой → pace undefined", () => {
    const p = projectProgress([100, 100.3], 120, { epsilon: 0.5 });
    expect(p.paceToTarget).toBeUndefined();
    expect(p.etaWeeks).toBeUndefined();
  });
});
