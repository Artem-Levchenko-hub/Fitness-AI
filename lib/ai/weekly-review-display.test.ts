import { describe, expect, it } from "vitest";

import { parseWeeklyReviewResult } from "@/lib/ai/weekly-review-display";

/** Минимальный валидный TrainerResponse (как хранит воркер H8.2 в
 *  ai_analyses.resultJson) — без optional-полей H5.4+. */
const VALID = {
  overallScore: 72,
  trainingQuality: { score: 70, comment: "ок" },
  recoveryContext: { score: null, comment: "нет данных" },
  nutritionContext: { score: null, comment: "нет данных" },
  exerciseComparisons: [],
  recommendations: ["добавь спину"],
  nextSessionFocus: "ноги 3×10",
  missingDataAdvice: null,
  motivation: "хорошая неделя",
};

describe("parseWeeklyReviewResult", () => {
  it("валидный resultJson → TrainerResponse (для TrainerResultCard)", () => {
    const r = parseWeeklyReviewResult(VALID);
    expect(r).not.toBeNull();
    expect(r?.overallScore).toBe(72);
    expect(r?.nextSessionFocus).toBe("ноги 3×10");
  });

  it("legacy resultJson без optional-полей H5.4+ → парсится (fail-soft, не null)", () => {
    // VALID уже без whatWorked/followUpQuestion/pastAdviceFollowUp/muscleBalanceNote
    const r = parseWeeklyReviewResult(VALID);
    expect(r).not.toBeNull();
    expect(r?.exerciseComparisons).toEqual([]);
  });

  it("resultJson с muscleBalanceNote (типичный weekly_review) → сохраняет поле", () => {
    const r = parseWeeklyReviewResult({
      ...VALID,
      muscleBalanceNote: "грудь 1600 / спина 0",
    });
    expect(r?.muscleBalanceNote).toBe("грудь 1600 / спина 0");
  });

  it("null → null (нет сохранённого разбора)", () => {
    expect(parseWeeklyReviewResult(null)).toBeNull();
  });

  it("битый/частичный объект → null (не валит /stats, R-10)", () => {
    expect(parseWeeklyReviewResult({ overallScore: 50 })).toBeNull();
    expect(parseWeeklyReviewResult("не json")).toBeNull();
    expect(parseWeeklyReviewResult({ overallScore: 150, motivation: 1 })).toBeNull();
  });
});
