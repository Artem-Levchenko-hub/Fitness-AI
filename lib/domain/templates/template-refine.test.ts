import { describe, expect, it } from "vitest";

import {
  buildRefinePrompt,
  refineTemplateRawSchema,
  sanitizeRefinedTemplate,
} from "./template-refine";

const validSlugs = new Set(["bench-press", "squat", "hyperextension"]);

function raw(over: Record<string, unknown> = {}) {
  return refineTemplateRawSchema.parse({
    score: 70,
    assessment: "Норм под рост груди",
    changes: ["Поднял жим до 4 подходов"],
    items: [
      {
        exerciseSlug: "bench-press",
        sets: 4,
        repsMin: 6,
        repsMax: 8,
        restSeconds: 120,
        note: null,
      },
    ],
    ...over,
  });
}

describe("sanitizeRefinedTemplate", () => {
  it("клампит числа и держит валидные slug", () => {
    const out = sanitizeRefinedTemplate(
      raw({
        items: [
          {
            exerciseSlug: "bench-press",
            sets: 99,
            repsMin: 8,
            repsMax: 3,
            restSeconds: 9000,
            note: "  до отказа  ",
          },
        ],
      }),
      validSlugs,
    );
    expect(out).not.toBeNull();
    const it0 = out!.items[0]!;
    expect(it0.sets).toBe(8); // кламп 1..8
    expect(it0.repsMax).toBeGreaterThanOrEqual(it0.repsMin); // repsMax≥repsMin
    expect(it0.restSeconds).toBe(600); // кламп 10..600
    expect(it0.note).toBe("до отказа");
  });

  it("выкидывает выдуманный slug и дедупит по slug", () => {
    const out = sanitizeRefinedTemplate(
      raw({
        items: [
          { exerciseSlug: "made-up", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
          { exerciseSlug: "squat", sets: 5, repsMin: 5, repsMax: 5, restSeconds: 180 },
          { exerciseSlug: "squat", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
        ],
      }),
      validSlugs,
    );
    expect(out!.items).toHaveLength(1);
    expect(out!.items[0]!.exerciseSlug).toBe("squat");
  });

  it("все slug невалидны → null (нечего применять)", () => {
    const out = sanitizeRefinedTemplate(
      raw({ items: [{ exerciseSlug: "xxx", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 }] }),
      validSlugs,
    );
    expect(out).toBeNull();
  });

  it("клампит score в 0..100", () => {
    expect(sanitizeRefinedTemplate(raw({ score: 500 }), validSlugs)!.score).toBe(100);
    expect(sanitizeRefinedTemplate(raw({ score: -3 }), validSlugs)!.score).toBe(0);
  });
});

describe("buildRefinePrompt", () => {
  it("включает шаблон, комментарий и каталог", () => {
    const prompt = buildRefinePrompt({
      name: "Грудь A",
      comment: "Убрал становую, болит спина",
      current: [
        {
          slug: "bench-press",
          nameRu: "Жим лёжа",
          primaryMuscles: ["chest"],
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetRestSeconds: 120,
          note: null,
        },
      ],
      catalog: [
        { slug: "hyperextension", nameRu: "Гиперэкстензия", primaryMuscles: ["hamstrings"] },
      ],
    });
    expect(prompt).toContain("Грудь A");
    expect(prompt).toContain("Убрал становую");
    expect(prompt).toContain("slug=bench-press");
    expect(prompt).toContain("hyperextension | Гиперэкстензия");
  });

  it("пустой комментарий → плейсхолдер про рост и баланс", () => {
    const prompt = buildRefinePrompt({
      name: "X",
      comment: "",
      current: [],
      catalog: [],
    });
    expect(prompt).toContain("просто улучши под рост и баланс");
  });
});
