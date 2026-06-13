import { describe, expect, it } from "vitest";

import { buildTrainerVoice } from "./trainer-voice";

/** H11.2 «голос тренера на /dashboard»: чистый резолвер строки-совета для
 *  главной из последних разборов. per-workout приоритетнее (свежий конкретный
 *  фидбэк сессии), fallback — недельный разбор (ведёт на /stats). Без AI-вызова
 *  (читаем уже сохранённые ai_analyses). Возвращает null, когда показывать
 *  нечего (анти-фантом R-37). */
describe("buildTrainerVoice", () => {
  const focusJson = (focus: string) => ({
    overallScore: 70,
    trainingQuality: { score: 70, comment: "" },
    recoveryContext: { score: null, comment: "" },
    nutritionContext: { score: null, comment: "" },
    exerciseComparisons: [],
    recommendations: [],
    nextSessionFocus: focus,
    missingDataAdvice: null,
    motivation: "",
  });

  it("силовой per-workout разбор → ссылка на /workouts/<id>/trainer", () => {
    const v = buildTrainerVoice(
      {
        id: "an-1",
        resultJson: focusJson("85×5 при RPE 8"),
        createdAt: new Date(),
        workoutId: "w-1",
        circuitWorkoutId: null,
      },
      null,
    );
    expect(v).toEqual({
      focus: "85×5 при RPE 8",
      analysisId: "an-1",
      href: "/workouts/w-1/trainer",
    });
  });

  it("круговой per-workout разбор → ссылка на /circuits/<id>", () => {
    const v = buildTrainerVoice(
      {
        id: "an-2",
        resultJson: focusJson("4 раунда вместо 3"),
        createdAt: new Date(),
        workoutId: null,
        circuitWorkoutId: "c-1",
      },
      null,
    );
    expect(v).toEqual({
      focus: "4 раунда вместо 3",
      analysisId: "an-2",
      href: "/circuits/c-1",
    });
  });

  it("per-workout без focus (legacy) → падает на недельный разбор → /stats", () => {
    const v = buildTrainerVoice(
      {
        id: "an-legacy",
        resultJson: { not: "a trainer json" },
        createdAt: new Date(),
        workoutId: "w-1",
        circuitWorkoutId: null,
      },
      { id: "wk-1", resultJson: focusJson("Добавь сессию на ноги"), createdAt: new Date() },
    );
    expect(v).toEqual({
      focus: "Добавь сессию на ноги",
      analysisId: "wk-1",
      href: "/stats",
    });
  });

  it("нет per-workout, есть недельный → /stats", () => {
    const v = buildTrainerVoice(null, {
      id: "wk-1",
      resultJson: focusJson("Добавь сессию на ноги"),
      createdAt: new Date(),
    });
    expect(v).toEqual({
      focus: "Добавь сессию на ноги",
      analysisId: "wk-1",
      href: "/stats",
    });
  });

  it("ни per-workout, ни недельного → null (анти-фантом)", () => {
    expect(buildTrainerVoice(null, null)).toBeNull();
  });

  it("оба без focus (legacy) → null", () => {
    const v = buildTrainerVoice(
      {
        id: "an-1",
        resultJson: { junk: true },
        createdAt: new Date(),
        workoutId: "w-1",
        circuitWorkoutId: null,
      },
      { id: "wk-1", resultJson: { junk: true }, createdAt: new Date() },
    );
    expect(v).toBeNull();
  });
});
