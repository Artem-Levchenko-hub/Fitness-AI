import { describe, expect, it } from "vitest";

import {
  extractJson,
  parseTrainerJson,
  renderTrainerMarkdown,
  type TrainerResponse,
} from "./trainer-parse";

/** Характеризационное покрытие парс/рендер-пути structured AI-разбора (G3).
 *  Это owner-facing хот-путь: thinking-модель (DeepSeek) возвращает reasoning +
 *  JSON, который extractJson вычищает → parseTrainerJson валидирует → карточка
 *  разбора. Битый парс = владелец видит ошибку вместо красивого разбора. */

describe("extractJson", () => {
  it("чистый JSON-объект возвращает как есть", () => {
    expect(extractJson(`{"a":1}`)).toBe(`{"a":1}`);
  });

  it("обрезает ведущие/хвостовые пробелы", () => {
    expect(extractJson(`  \n {"a":1} \n `)).toBe(`{"a":1}`);
  });

  it("снимает ```json-ограждение", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toBe(`{"a":1}`);
  });

  it("снимает голое ```-ограждение (без json-метки)", () => {
    expect(extractJson("```\n{\"a\":1}\n```")).toBe(`{"a":1}`);
  });

  it("срезает reasoning-текст ДО первой { и ПОСЛЕ последней }", () => {
    const raw = 'Думаю, тренировка хорошая. {"a":1} Вот и всё.';
    expect(extractJson(raw)).toBe(`{"a":1}`);
  });

  it("держит вложенные скобки — last } = конец внешнего объекта", () => {
    const raw = '{"a":{"b":2},"c":3}';
    expect(extractJson(raw)).toBe(`{"a":{"b":2},"c":3}`);
  });

  it("без скобок возвращает строку как есть (parse потом бросит)", () => {
    expect(extractJson("совсем не json")).toBe("совсем не json");
  });

  it("ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ: { в reasoning-прозе ломает срез", () => {
    // first-{ ловит прозаическую скобку, не JSON → результат не парсится.
    // Защита на уровне промпта ('Никакого текста до или после JSON') + fence.
    const raw = 'Смайл {} потом {"a":1}';
    expect(extractJson(raw)).toBe(`{} потом {"a":1}`);
  });
});

const VALID: TrainerResponse = {
  overallScore: 82,
  trainingQuality: { score: 80, comment: "Хорошая работа" },
  recoveryContext: { score: 70, comment: "Сон ок" },
  nutritionContext: { score: 60, comment: "Белка маловато" },
  exerciseComparisons: [
    {
      name: "Жим лёжа",
      prevTopSet: "60×5",
      curTopSet: "60×6",
      deltaReps: 1,
      deltaWeightKg: 0,
      status: "improved",
    },
  ],
  recommendations: ["Добавь белка", "Спи 8ч"],
  nextSessionFocus: "Тяга",
  missingDataAdvice: null,
  motivation: "Так держать!",
};

describe("parseTrainerJson", () => {
  it("валидный полный объект → типизированный результат", () => {
    expect(parseTrainerJson(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("распаковывает из ```json-обёртки thinking-модели", () => {
    const raw = "```json\n" + JSON.stringify(VALID) + "\n```";
    expect(parseTrainerJson(raw)).toEqual(VALID);
  });

  it("опущенный exerciseComparisons → default []", () => {
    const rest: Record<string, unknown> = { ...VALID };
    delete rest.exerciseComparisons;
    const result = parseTrainerJson(JSON.stringify(rest));
    expect(result.exerciseComparisons).toEqual([]);
  });

  it("nullable score (нет данных сна/КБЖУ) принимается", () => {
    const withNulls = {
      ...VALID,
      recoveryContext: { score: null, comment: "нет данных" },
      nutritionContext: { score: null, comment: "нет данных" },
    };
    const result = parseTrainerJson(JSON.stringify(withNulls));
    expect(result.recoveryContext.score).toBeNull();
    expect(result.nutritionContext.score).toBeNull();
  });

  it("невалидный JSON → бросает с фрагментом", () => {
    expect(() => parseTrainerJson("не json {")).toThrow(/невалидный JSON/);
  });

  it("score вне 0..100 → бросает ошибку валидации схемы", () => {
    const bad = { ...VALID, overallScore: 150 };
    expect(() => parseTrainerJson(JSON.stringify(bad))).toThrow(
      /не прошёл валидацию схемы/,
    );
  });

  it("неизвестный status упражнения → бросает ошибку валидации схемы", () => {
    const bad = {
      ...VALID,
      exerciseComparisons: [{ ...VALID.exerciseComparisons[0], status: "wat" }],
    };
    expect(() => parseTrainerJson(JSON.stringify(bad))).toThrow(
      /не прошёл валидацию схемы/,
    );
  });
});

describe("renderTrainerMarkdown", () => {
  it("заголовок несёт overallScore и motivation", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).toContain("# Разбор тренировки (82/100)");
    expect(md).toContain("**Так держать!**");
  });

  it("числовые score рендерятся, рекомендации = буллеты", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).toContain("## Качество тренировки · 80/100");
    expect(md).toContain("## Восстановление (сон) · 70");
    expect(md).toContain("## Питание (КБЖУ) · 60");
    expect(md).toContain("- Добавь белка");
    expect(md).toContain("- Спи 8ч");
  });

  it("null-score → тире вместо числа", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      recoveryContext: { score: null, comment: "—" },
      nutritionContext: { score: null, comment: "—" },
    });
    expect(md).toContain("## Восстановление (сон) · —");
    expect(md).toContain("## Питание (КБЖУ) · —");
  });

  it("missingDataAdvice present → добавляет секцию", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      missingDataAdvice: "Залогируй сон",
    });
    expect(md).toContain("## Чтобы разбор был точнее");
    expect(md).toContain("Залогируй сон");
  });

  it("missingDataAdvice null → секция опущена", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).not.toContain("Чтобы разбор был точнее");
  });

  it("whatWorked present → секция «Что хорошо» (H5.4)", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      whatWorked: "Жим +2.5 kg vs прошлый раз",
    });
    expect(md).toContain("## Что хорошо");
    expect(md).toContain("Жим +2.5 kg vs прошлый раз");
  });

  it("followUpQuestion present → секция «Вопрос от тренера» (H5.4)", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      followUpQuestion: "Как плечо после жима?",
    });
    expect(md).toContain("## Вопрос от тренера");
    expect(md).toContain("_Как плечо после жима?_");
  });

  it("whatWorked/followUpQuestion отсутствуют → секции опущены (legacy)", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).not.toContain("## Что хорошо");
    expect(md).not.toContain("## Вопрос от тренера");
  });

  it("pastAdviceFollowUp present → секция «Прошлый совет» (H5.5)", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      pastAdviceFollowUp: "В прошлый раз я советовал жим 85×5 — вышел на 85×5, выполнил.",
    });
    expect(md).toContain("## Прошлый совет");
    expect(md).toContain("В прошлый раз я советовал");
  });

  it("pastAdviceFollowUp отсутствует → секция опущена (legacy)", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).not.toContain("## Прошлый совет");
  });

  it("muscleBalanceNote present → секция «Баланс по аватару» (H5.6)", () => {
    const md = renderTrainerMarkdown({
      ...VALID,
      muscleBalanceNote:
        "Грудь перегрета (16 подходов), квадрицепс холодный (0) — добавь присед 3×8.",
    });
    expect(md).toContain("## Баланс по аватару");
    expect(md).toContain("квадрицепс холодный");
  });

  it("muscleBalanceNote отсутствует → секция опущена (legacy)", () => {
    const md = renderTrainerMarkdown(VALID);
    expect(md).not.toContain("## Баланс по аватару");
  });
});
