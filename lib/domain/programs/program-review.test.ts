import { describe, expect, it } from "vitest";

import {
  buildProgramReviewPrompt,
  programReviewRawSchema,
  sanitizeProgramReview,
  weeklyMuscleSets,
  type ProgramReviewDay,
} from "./program-review";

const days: ProgramReviewDay[] = [
  {
    name: "Верх A",
    exercises: [
      {
        nameRu: "Жим лёжа",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["triceps", "shoulders_front"],
        targetSets: 4,
        targetRepsMin: 6,
        targetRepsMax: 8,
      },
    ],
  },
  {
    name: "Низ A",
    exercises: [
      {
        nameRu: "Присед",
        primaryMuscles: ["quads"],
        secondaryMuscles: ["glutes"],
        targetSets: 5,
        targetRepsMin: 5,
        targetRepsMax: 5,
      },
    ],
  },
];

describe("weeklyMuscleSets", () => {
  it("складывает подходы по группам: primary ×1, secondary ×0.5", () => {
    const rows = weeklyMuscleSets(days);
    const map = new Map(rows.map((r) => [r.muscle, r.sets]));
    expect(map.get("chest")).toBe(4); // 4 × 1
    expect(map.get("triceps")).toBe(2); // 4 × 0.5
    expect(map.get("shoulders_front")).toBe(2);
    expect(map.get("quads")).toBe(5);
    expect(map.get("glutes")).toBe(2.5); // 5 × 0.5
  });

  it("сортирует по убыванию объёма", () => {
    const rows = weeklyMuscleSets(days);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.sets).toBeGreaterThanOrEqual(rows[i]!.sets);
    }
  });

  it("пустая программа → пустой список", () => {
    expect(weeklyMuscleSets([])).toEqual([]);
  });
});

describe("sanitizeProgramReview", () => {
  it("клампит score в 0..100 и режет списки до 6", () => {
    const raw = programReviewRawSchema.parse({
      score: 250,
      summary: "Норм",
      strengths: Array.from({ length: 10 }, (_, i) => `s${i}`),
      weaknesses: [],
      recommendations: [],
      muscleBalance: "  ",
    });
    const out = sanitizeProgramReview(raw);
    expect(out.score).toBe(100);
    expect(out.strengths).toHaveLength(6);
    expect(out.muscleBalance).toBeNull(); // пустая строка → null
  });

  it("отрицательный/NaN score → 0", () => {
    const out = sanitizeProgramReview(
      programReviewRawSchema.parse({ score: -5, summary: "x" }),
    );
    expect(out.score).toBe(0);
  });
});

describe("buildProgramReviewPrompt", () => {
  it("включает дни, упражнения и посчитанный недельный объём", () => {
    const prompt = buildProgramReviewPrompt({
      name: "Мой сплит",
      description: null,
      days,
    });
    expect(prompt).toContain("Мой сплит");
    expect(prompt).toContain("Жим лёжа");
    expect(prompt).toContain("chest: 4 подх/нед");
    expect(prompt).toContain("Никакого текста до или после JSON");
  });
});
