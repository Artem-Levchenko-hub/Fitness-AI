import { describe, expect, it } from "vitest";

import { formatGoalsBlock } from "./goals-block";
import type { GoalProgressView } from "@/lib/domain/progression/goal-projection";

/** Хелпер: собрать GoalProgressView вручную (формат-функция потребляет готовый
 *  view — H18.2-A summarizeGoalProgress, R-04 не пересчитываем). */
function view(p: Partial<GoalProgressView> & { target: number }): GoalProgressView {
  return {
    current: p.current ?? null,
    target: p.target,
    pct: p.pct ?? 0,
    etaWeeks: p.etaWeeks ?? null,
    reached: p.reached ?? false,
  };
}

describe("formatGoalsBlock (H18.3 «# Цель»)", () => {
  it("оба списка пусты → null (R-37, без фантомного блока)", () => {
    expect(formatGoalsBlock({ exerciseGoals: [], muscleGoals: [] })).toBeNull();
  });

  it("цель упражнения на темпе → текущее→цель, %, ETA вслух", () => {
    const block = formatGoalsBlock({
      exerciseGoals: [
        {
          nameRu: "Жим лёжа",
          kind: "weight",
          view: view({ current: 80, target: 100, pct: 0.8, etaWeeks: 5 }),
        },
      ],
      muscleGoals: [],
    });
    expect(block).not.toBeNull();
    expect(block).toContain("# Цель");
    expect(block).toContain("Жим лёжа");
    expect(block).toContain("80");
    expect(block).toContain("100");
    expect(block).toContain("80%");
    expect(block).toMatch(/темп.*5/);
  });

  it("цель достигнута → ДОСТИГНУТА 🎯 (milestone-сигнал тренеру)", () => {
    const block = formatGoalsBlock({
      exerciseGoals: [
        {
          nameRu: "Жим лёжа",
          kind: "1rm",
          view: view({ current: 105, target: 100, pct: 1, reached: true, etaWeeks: 0 }),
        },
      ],
      muscleGoals: [],
    });
    expect(block).toContain("ДОСТИГНУТА");
    expect(block).toContain("🎯");
    expect(block).toContain("105");
  });

  it("застой (eta null, не достигнута) → честно «темпа к цели пока нет»", () => {
    const block = formatGoalsBlock({
      exerciseGoals: [
        {
          nameRu: "Присед",
          kind: "weight",
          view: view({ current: 120, target: 140, pct: 0.857, etaWeeks: null }),
        },
      ],
      muscleGoals: [],
    });
    expect(block).toContain("Присед");
    expect(block).toContain("темпа к цели пока нет");
    expect(block).not.toContain("ДОСТИГНУТА");
  });

  it("цель есть, истории нет (current null) → «истории пока нет»", () => {
    const block = formatGoalsBlock({
      exerciseGoals: [
        {
          nameRu: "Тяга",
          kind: "weight",
          view: view({ current: null, target: 90 }),
        },
      ],
      muscleGoals: [],
    });
    expect(block).toContain("Тяга");
    expect(block).toContain("истории пока нет");
  });

  it("цель частоты группы → подх./нед + дробный current/target печатается чисто", () => {
    const block = formatGoalsBlock({
      exerciseGoals: [],
      muscleGoals: [
        {
          label: "Грудь",
          view: view({ current: 10, target: 12, pct: 0.833, etaWeeks: null }),
        },
      ],
    });
    expect(block).toContain("# Цель");
    expect(block).toContain("Грудь");
    expect(block).toContain("подх./нед");
    expect(block).toContain("10");
    expect(block).toContain("12");
  });
});
