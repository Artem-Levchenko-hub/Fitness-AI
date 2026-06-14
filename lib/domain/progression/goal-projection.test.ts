import { describe, expect, it } from "vitest";

import { projectProgress, summarizeGoalProgress } from "./goal-projection";

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

describe("summarizeGoalProgress", () => {
  it("пустая история → current null, pct 0, не достигнуто, eta null", () => {
    const v = summarizeGoalProgress([], 100);
    expect(v.current).toBeNull();
    expect(v.target).toBe(100);
    expect(v.pct).toBe(0);
    expect(v.reached).toBe(false);
    expect(v.etaWeeks).toBeNull();
  });

  it("растущая серия [60,70,80] цель 100 → current 80, pct 0.8, не достигнуто", () => {
    const v = summarizeGoalProgress([60, 70, 80], 100);
    expect(v.current).toBe(80);
    expect(v.pct).toBeCloseTo(0.8, 5);
    expect(v.reached).toBe(false);
    // растёт +10/нед за 2 интервала → (100−80)/10 = 2 нед
    expect(v.etaWeeks).toBeCloseTo(2, 5);
  });

  it("цель достигнута (current ≥ target) → pct 1, reached, eta 0", () => {
    const v = summarizeGoalProgress([90, 105], 100);
    expect(v.current).toBe(105);
    expect(v.pct).toBe(1); // клампится, не >1
    expect(v.reached).toBe(true);
    expect(v.etaWeeks).toBe(0);
  });

  it("застой ниже цели → pct по current/target, eta null (темпа нет)", () => {
    const v = summarizeGoalProgress([80, 80, 80], 100);
    expect(v.current).toBe(80);
    expect(v.pct).toBeCloseTo(0.8, 5);
    expect(v.reached).toBe(false);
    expect(v.etaWeeks).toBeNull();
  });

  it("неположительная цель → pct 0 (защита от деления на 0/отрицательное)", () => {
    const v = summarizeGoalProgress([80], 0);
    expect(v.pct).toBe(0);
  });
});
