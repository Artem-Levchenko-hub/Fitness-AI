import { describe, expect, it } from "vitest";

import { clampNumber, sanitizeNumeric } from "./numeric";

describe("sanitizeNumeric — integer mode", () => {
  it("срезает ведущий ноль: 06 → 6 (главный баг)", () => {
    expect(sanitizeNumeric("06")).toBe("6");
    expect(sanitizeNumeric("007")).toBe("7");
  });
  it("оставляет нормальные числа", () => {
    expect(sanitizeNumeric("60")).toBe("60");
    expect(sanitizeNumeric("6")).toBe("6");
  });
  it("одиночный ноль остаётся", () => {
    expect(sanitizeNumeric("0")).toBe("0");
    expect(sanitizeNumeric("00")).toBe("0");
  });
  it("выкидывает нецифры", () => {
    expect(sanitizeNumeric("12a3")).toBe("123");
    expect(sanitizeNumeric("abc")).toBe("");
    expect(sanitizeNumeric("")).toBe("");
  });
  it("точки нет в integer-режиме", () => {
    expect(sanitizeNumeric("6.5")).toBe("65");
  });
});

describe("sanitizeNumeric — decimal mode", () => {
  const d = { decimal: true };
  it("одна точка, лишние — отбрасываются", () => {
    expect(sanitizeNumeric("6.5.5", d)).toBe("6.55");
  });
  it("запятая → точка", () => {
    expect(sanitizeNumeric("1,5", d)).toBe("1.5");
  });
  it("ноль перед точкой сохраняется", () => {
    expect(sanitizeNumeric("0.5", d)).toBe("0.5");
    expect(sanitizeNumeric(".5", d)).toBe(".5");
  });
  it("ведущий ноль у целой части срезается: 06.5 → 6.5", () => {
    expect(sanitizeNumeric("06.5", d)).toBe("6.5");
  });
});

describe("clampNumber", () => {
  it("зажимает в диапазон", () => {
    expect(clampNumber("6", 1, 100)).toBe(6);
    expect(clampNumber("0", 1, 100)).toBe(1);
    expect(clampNumber("150", 1, 100)).toBe(100);
  });
  it("пусто/точка/мусор → null", () => {
    expect(clampNumber("")).toBeNull();
    expect(clampNumber(".")).toBeNull();
  });
  it("decimal проходит", () => {
    expect(clampNumber("6.5", 0, 1000)).toBe(6.5);
  });
});
