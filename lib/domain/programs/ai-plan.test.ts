import { describe, expect, it } from "vitest";

import {
  aiPlanRawSchema,
  buildPlanComposerPrompt,
  PLAN_SYSTEM_INSTRUCTION,
  sanitizeAiPlan,
  type AiPlanRaw,
  type PlanIntake,
} from "./ai-plan";

const VALID = new Set(["back-squat", "leg-press", "glute-bridge"]);

function rawPlan(overrides: Partial<AiPlanRaw> = {}): AiPlanRaw {
  return {
    name: "Тестовый план",
    description: "Под силу и гипертрофию.",
    days: [
      {
        name: "День A",
        focus: "Низ",
        items: [
          {
            exerciseSlug: "back-squat",
            sets: 4,
            repsMin: 6,
            repsMax: 10,
            restSeconds: 180,
            note: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("sanitizeAiPlan", () => {
  it("дропает упражнения с неизвестным slug", () => {
    const raw = rawPlan({
      days: [
        {
          name: "День A",
          focus: "Низ",
          items: [
            { exerciseSlug: "back-squat", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, note: null },
            { exerciseSlug: "made-up-exercise", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, note: null },
          ],
        },
      ],
    });
    const plan = sanitizeAiPlan(raw, VALID)!;
    expect(plan.days[0].items).toHaveLength(1);
    expect(plan.days[0].items[0].exerciseSlug).toBe("back-squat");
  });

  it("дропает день, если в нём не осталось валидных упражнений", () => {
    const raw = rawPlan({
      days: [
        {
          name: "Мусорный день",
          focus: "",
          items: [
            { exerciseSlug: "nope", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, note: null },
          ],
        },
        {
          name: "День B",
          focus: "Низ",
          items: [
            { exerciseSlug: "leg-press", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 120, note: null },
          ],
        },
      ],
    });
    const plan = sanitizeAiPlan(raw, VALID)!;
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].name).toBe("День B");
  });

  it("возвращает null, если ни одного валидного упражнения не осталось", () => {
    const raw = rawPlan({
      days: [
        {
          name: "День",
          focus: "",
          items: [
            { exerciseSlug: "ghost", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, note: null },
          ],
        },
      ],
    });
    expect(sanitizeAiPlan(raw, VALID)).toBeNull();
  });

  it("клампит числа вне диапазона и чинит repsMax < repsMin", () => {
    const raw = rawPlan({
      days: [
        {
          name: "День A",
          focus: "Низ",
          items: [
            { exerciseSlug: "back-squat", sets: 99, repsMin: 12, repsMax: 5, restSeconds: 9999, note: "  " },
          ],
        },
      ],
    });
    const plan = sanitizeAiPlan(raw, VALID)!;
    const it0 = plan.days[0].items[0];
    expect(it0.sets).toBe(8); // clamp 1..8
    expect(it0.repsMin).toBe(12);
    expect(it0.repsMax).toBe(12); // repsMax поднят до repsMin
    expect(it0.restSeconds).toBe(600); // clamp 10..600
    expect(it0.note).toBeNull(); // пустая строка → null
  });
});

describe("buildPlanComposerPrompt", () => {
  const intake: PlanIntake = {
    goal: "восстановить колено и набрать мышцы",
    experience: "новичок",
    schedule: "3 раза в неделю по часу",
    equipment: "зал",
    limitations: "болит левое колено",
    notes: "",
  };

  it("включает свободные ответы клиента и каталог", () => {
    const prompt = buildPlanComposerPrompt(intake, [
      { slug: "glute-bridge", nameRu: "Ягодичный мост", primaryMuscles: ["glutes"] },
    ]);
    expect(prompt).toContain("восстановить колено и набрать мышцы");
    expect(prompt).toContain("болит левое колено");
    expect(prompt).toContain("3 раза в неделю по часу");
    expect(prompt).toContain("glute-bridge | Ягодичный мост | glutes");
  });

  it("каталог — единственный источник slug-ов", () => {
    const prompt = buildPlanComposerPrompt(intake, [
      { slug: "leg-press", nameRu: "Жим ногами", primaryMuscles: ["quads"] },
    ]);
    expect(prompt).toContain("выбирай slug ТОЛЬКО отсюда");
  });

  it("незаполненные открытые поля помечаются «не указан»", () => {
    const prompt = buildPlanComposerPrompt(
      { ...intake, experience: "", schedule: "" },
      [{ slug: "leg-press", nameRu: "Жим ногами", primaryMuscles: ["quads"] }],
    );
    expect(prompt).toContain("не указан");
  });
});

describe("PLAN_SYSTEM_INSTRUCTION", () => {
  it("несёт гайд по всем целям, включая реабилитацию коленей", () => {
    expect(PLAN_SYSTEM_INSTRUCTION).toContain("Восстановление коленей");
    expect(PLAN_SYSTEM_INSTRUCTION).toContain("береги коленный сустав");
    expect(PLAN_SYSTEM_INSTRUCTION).toContain("Сила:");
    expect(PLAN_SYSTEM_INSTRUCTION).toContain("Выносливость:");
  });
});

describe("aiPlanRawSchema", () => {
  it("принимает валидный план и проставляет focus по умолчанию", () => {
    const parsed = aiPlanRawSchema.parse({
      name: "План",
      description: "",
      days: [
        {
          name: "День A",
          items: [
            { exerciseSlug: "back-squat", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120 },
          ],
        },
      ],
    });
    expect(parsed.days[0].focus).toBe("");
  });

  it("отклоняет план без дней", () => {
    expect(() =>
      aiPlanRawSchema.parse({ name: "x", description: "", days: [] }),
    ).toThrow();
  });
});
