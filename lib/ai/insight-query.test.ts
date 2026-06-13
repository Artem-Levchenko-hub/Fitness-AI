import { describe, expect, it } from "vitest";

import { buildInsightQuery } from "./insight-query";

describe("buildInsightQuery", () => {
  it("включает мышцы, упражнения и базовые EN-термины", () => {
    const q = buildInsightQuery({
      muscleGroups: ["chest", "triceps"],
      exerciseNamesEn: ["Barbell Bench Press"],
    });
    expect(q).toContain("chest");
    expect(q).toContain("triceps");
    expect(q).toContain("Barbell Bench Press");
    // якорь темы — гипертрофия (EN-корпус)
    expect(q).toContain("hypertrophy");
  });

  it("пустая сессия → только базовые EN-термины (запрос не пустой)", () => {
    const q = buildInsightQuery({ muscleGroups: [], exerciseNamesEn: [] });
    expect(q).toBe("hypertrophy muscle growth training volume rest periods");
    expect(q.length).toBeGreaterThan(0);
  });

  it("нормализует подчёркивания ключей мышц в естественный EN-токен", () => {
    const q = buildInsightQuery({
      muscleGroups: ["back_lats", "shoulders_front"],
      exerciseNamesEn: [],
    });
    expect(q).toContain("back lats");
    expect(q).toContain("shoulders front");
    expect(q).not.toContain("back_lats");
  });

  it("схлопывает дубли групп мышц (без учёта регистра)", () => {
    const q = buildInsightQuery({
      muscleGroups: ["chest", "Chest", "chest"],
      exerciseNamesEn: [],
    });
    // одно «chest» среди токенов до базовых терминов
    const muscleTokens = q
      .replace(" hypertrophy muscle growth training volume rest periods", "")
      .split(" ")
      .filter(Boolean);
    expect(muscleTokens).toEqual(["chest"]);
  });

  it("чистит пустые/пробельные имена упражнений и дубли", () => {
    const q = buildInsightQuery({
      muscleGroups: [],
      exerciseNamesEn: ["Squat", "  ", "Squat", ""],
    });
    expect(q).toBe("Squat hypertrophy muscle growth training volume rest periods");
  });
});
