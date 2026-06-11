import { describe, expect, it } from "vitest";

import { assertCoachTemplate, isCoachTemplateComplete } from "./coach-template";
import type { TrainerResponse } from "./trainer-parse";

/** H5.4 — проверяемый 4-элементный шаблон тона «как тренер».
 *  assertCoachTemplate — единая точка истины: какие из 4 обязательных
 *  элементов разбор реально несёт. Используется и в юнит-тесте, и в
 *  прод-гейте (доказать, что завершённая тренировка даёт все 4). */

const COMPLETE: TrainerResponse = {
  overallScore: 82,
  trainingQuality: { score: 80, comment: "Тоннаж 4200 кг" },
  recoveryContext: { score: 70, comment: "Сон 7.5ч" },
  nutritionContext: { score: 60, comment: "Белок 1.4 г/кг" },
  exerciseComparisons: [
    {
      name: "Жим лёжа",
      prevTopSet: "80×5",
      curTopSet: "82.5×5",
      deltaReps: 0,
      deltaWeightKg: 2.5,
      status: "improved",
    },
  ],
  recommendations: ["Жим: +2.5 kg до RPE 8"],
  nextSessionFocus: "Тяга +2.5 kg",
  missingDataAdvice: null,
  motivation: "Жим +2.5 кг — держи темп",
  whatWorked: "Жим вырос с 80×5 до 82.5×5 — чистый progressive overload",
  followUpQuestion: "Как спина чувствовала себя после тяги?",
};

describe("assertCoachTemplate", () => {
  it("полный 4-элементный разбор → все четыре true", () => {
    expect(assertCoachTemplate(COMPLETE)).toEqual({
      pastReference: true,
      whatWorked: true,
      correction: true,
      followUpQuestion: true,
    });
    expect(isCoachTemplateComplete(COMPLETE)).toBe(true);
  });

  it("нет прошлой сессии ни у одного упражнения → pastReference false", () => {
    const noPast: TrainerResponse = {
      ...COMPLETE,
      exerciseComparisons: [
        { ...COMPLETE.exerciseComparisons[0], prevTopSet: null, status: "new" },
      ],
    };
    expect(assertCoachTemplate(noPast).pastReference).toBe(false);
    expect(isCoachTemplateComplete(noPast)).toBe(false);
  });

  it("пустой exerciseComparisons → pastReference false", () => {
    const empty: TrainerResponse = { ...COMPLETE, exerciseComparisons: [] };
    expect(assertCoachTemplate(empty).pastReference).toBe(false);
  });

  it("whatWorked отсутствует/пустой → whatWorked false", () => {
    expect(
      assertCoachTemplate({ ...COMPLETE, whatWorked: undefined }).whatWorked,
    ).toBe(false);
    expect(
      assertCoachTemplate({ ...COMPLETE, whatWorked: "   " }).whatWorked,
    ).toBe(false);
  });

  it("nextSessionFocus пустой → correction false", () => {
    expect(
      assertCoachTemplate({ ...COMPLETE, nextSessionFocus: "  " }).correction,
    ).toBe(false);
  });

  it("followUpQuestion без знака вопроса → followUpQuestion false", () => {
    expect(
      assertCoachTemplate({ ...COMPLETE, followUpQuestion: "Расскажи про сон" })
        .followUpQuestion,
    ).toBe(false);
  });

  it("followUpQuestion отсутствует → followUpQuestion false", () => {
    expect(
      assertCoachTemplate({ ...COMPLETE, followUpQuestion: undefined })
        .followUpQuestion,
    ).toBe(false);
  });
});
