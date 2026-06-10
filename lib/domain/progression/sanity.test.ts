import { describe, expect, it } from "vitest";

import { assessProgressJump } from "./sanity";

describe("assessProgressJump", () => {
  it("большой скачок (+60% и >10кг) → подозрительный (кейс владельца +50кг)", () => {
    const r = assessProgressJump(100, 160);
    expect(r.suspicious).toBe(true);
    expect(r.deltaKg).toBe(60);
    expect(r.pct).toBeCloseTo(0.6, 5);
  });

  it("нормальный недельный прирост (+3%) → не подозрительный", () => {
    const r = assessProgressJump(100, 103);
    expect(r.suspicious).toBe(false);
  });

  it("большой % но малая абсолютная дельта (<10кг) → не флагуем (лёгкое упр.)", () => {
    const r = assessProgressJump(5, 8);
    expect(r.suspicious).toBe(false);
    expect(r.deltaKg).toBe(3);
  });

  it("ровно на пороге (+20% и +20кг) → подозрительный", () => {
    const r = assessProgressJump(100, 120);
    expect(r.suspicious).toBe(true);
  });

  it("чуть ниже % порога (+19%) → не подозрительный", () => {
    const r = assessProgressJump(100, 119);
    expect(r.suspicious).toBe(false);
  });

  it("нет базы (previousKg=0) → не подозрительный, pct=0", () => {
    const r = assessProgressJump(0, 160);
    expect(r.suspicious).toBe(false);
    expect(r.pct).toBe(0);
  });

  it("регресс → не подозрительный, дельта отрицательна", () => {
    const r = assessProgressJump(120, 100);
    expect(r.suspicious).toBe(false);
    expect(r.deltaKg).toBe(-20);
  });

  it("невалидные входы (NaN) → безопасно не подозрительный", () => {
    expect(assessProgressJump(Number.NaN, 160).suspicious).toBe(false);
    expect(assessProgressJump(100, Number.NaN).suspicious).toBe(false);
  });
});
