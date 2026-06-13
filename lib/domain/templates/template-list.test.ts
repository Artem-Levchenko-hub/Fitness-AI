import { describe, expect, it } from "vitest";

import {
  buildCardioTemplateRows,
  buildCircuitTemplateRows,
  buildStrengthTemplateRows,
  formatExerciseCount,
  formatTemplateMeta,
  mergeTemplateList,
  type CardioTemplateListSource,
  type TemplateListSource,
  type UnifiedTemplateItem,
} from "./template-list";

const d = (iso: string) => new Date(iso);

describe("mergeTemplateList", () => {
  it("tags each source with its format", () => {
    const merged = mergeTemplateList(
      [
        {
          id: "s1",
          name: "Грудь",
          description: null,
          exerciseCount: 4,
          updatedAt: d("2026-06-10T10:00:00Z"),
        },
      ],
      [
        {
          id: "c1",
          name: "Кор-круг",
          description: "быстро",
          exerciseCount: 3,
          updatedAt: d("2026-06-09T10:00:00Z"),
        },
      ],
    );

    expect(merged.map((m) => [m.id, m.format])).toEqual([
      ["s1", "strength"],
      ["c1", "circuit"],
    ]);
  });

  it("sorts by updatedAt desc across both sources (interleaved)", () => {
    const merged = mergeTemplateList(
      [
        {
          id: "s-old",
          name: "old",
          description: null,
          exerciseCount: 1,
          updatedAt: d("2026-06-01T00:00:00Z"),
        },
        {
          id: "s-new",
          name: "new",
          description: null,
          exerciseCount: 1,
          updatedAt: d("2026-06-12T00:00:00Z"),
        },
      ],
      [
        {
          id: "c-mid",
          name: "mid",
          description: null,
          exerciseCount: 1,
          updatedAt: d("2026-06-08T00:00:00Z"),
        },
      ],
    );

    expect(merged.map((m) => m.id)).toEqual(["s-new", "c-mid", "s-old"]);
  });

  it("preserves name/description/exerciseCount fields", () => {
    const [item] = mergeTemplateList(
      [],
      [
        {
          id: "c1",
          name: "Табата",
          description: "20/10",
          exerciseCount: 5,
          updatedAt: d("2026-06-12T00:00:00Z"),
        },
      ],
    );
    expect(item).toEqual({
      id: "c1",
      name: "Табата",
      description: "20/10",
      exerciseCount: 5,
      updatedAt: d("2026-06-12T00:00:00Z"),
      format: "circuit",
    });
  });

  it("returns [] when both sources empty", () => {
    expect(mergeTemplateList([], [])).toEqual([]);
  });

  it("tags cardio source and preserves metaLine (no exerciseCount)", () => {
    const [item] = mergeTemplateList(
      [],
      [],
      [
        {
          id: "cd1",
          name: "Утренний HIIT",
          description: null,
          metaLine: "Tabata",
          updatedAt: d("2026-06-12T00:00:00Z"),
        },
      ],
    );
    expect(item).toEqual({
      id: "cd1",
      name: "Утренний HIIT",
      description: null,
      metaLine: "Tabata",
      updatedAt: d("2026-06-12T00:00:00Z"),
      format: "cardio",
    });
  });

  it("interleaves all three formats by updatedAt desc", () => {
    const merged = mergeTemplateList(
      [
        {
          id: "s",
          name: "s",
          description: null,
          exerciseCount: 1,
          updatedAt: d("2026-06-10T00:00:00Z"),
        },
      ],
      [
        {
          id: "c",
          name: "c",
          description: null,
          exerciseCount: 1,
          updatedAt: d("2026-06-12T00:00:00Z"),
        },
      ],
      [
        {
          id: "cd",
          name: "cd",
          description: null,
          metaLine: "EMOM 10 мин",
          updatedAt: d("2026-06-11T00:00:00Z"),
        },
      ],
    );
    expect(merged.map((m) => [m.id, m.format])).toEqual([
      ["c", "circuit"],
      ["cd", "cardio"],
      ["s", "strength"],
    ]);
  });
});

describe("formatTemplateMeta", () => {
  const strength = (exerciseCount: number): UnifiedTemplateItem => ({
    id: "s",
    name: "Грудь",
    description: null,
    exerciseCount,
    updatedAt: new Date("2026-06-12T00:00:00Z"),
    format: "strength",
  });

  it("leads with the format label as text (R-41 — not only color)", () => {
    expect(formatTemplateMeta(strength(6))).toBe("Силовая · 6 упражнений");
  });

  it("pluralizes упражнение by Russian rules", () => {
    expect(formatTemplateMeta(strength(1))).toBe("Силовая · 1 упражнение");
    expect(formatTemplateMeta(strength(3))).toBe("Силовая · 3 упражнения");
    expect(formatTemplateMeta(strength(5))).toBe("Силовая · 5 упражнений");
    expect(formatTemplateMeta(strength(11))).toBe("Силовая · 11 упражнений");
    expect(formatTemplateMeta(strength(21))).toBe("Силовая · 21 упражнение");
  });

  it("labels a circuit template with its exercise count", () => {
    expect(
      formatTemplateMeta({
        id: "c",
        name: "Кор-круг",
        description: null,
        exerciseCount: 4,
        updatedAt: new Date("2026-06-12T00:00:00Z"),
        format: "circuit",
      }),
    ).toBe("Круговая · 4 упражнения");
  });

  it("uses the interval summary for cardio (no exercise count)", () => {
    expect(
      formatTemplateMeta({
        id: "cd",
        name: "Утренний HIIT",
        description: null,
        metaLine: "Свой · 6×30/60с",
        updatedAt: new Date("2026-06-12T00:00:00Z"),
        format: "cardio",
      }),
    ).toBe("Кардио · Свой · 6×30/60с");
  });
});

describe("formatExerciseCount", () => {
  it("pluralizes упражнение by Russian rules", () => {
    expect(formatExerciseCount(1)).toBe("1 упражнение");
    expect(formatExerciseCount(3)).toBe("3 упражнения");
    expect(formatExerciseCount(5)).toBe("5 упражнений");
    expect(formatExerciseCount(11)).toBe("11 упражнений");
    expect(formatExerciseCount(21)).toBe("21 упражнение");
    expect(formatExerciseCount(0)).toBe("0 упражнений");
  });
});

describe("buildStrengthTemplateRows", () => {
  const tpl = (over: Partial<TemplateListSource> = {}): TemplateListSource => ({
    id: "t1",
    name: "Грудь+трицепс",
    description: null,
    exerciseCount: 6,
    updatedAt: new Date("2026-06-12T00:00:00Z"),
    ...over,
  });

  it("returns [] for no templates (R-37 empty → builder, not phantom list)", () => {
    expect(buildStrengthTemplateRows([])).toEqual([]);
  });

  it("maps id, name, repeat href and pluralized exercise meta", () => {
    expect(buildStrengthTemplateRows([tpl()])).toEqual([
      {
        id: "t1",
        name: "Грудь+трицепс",
        href: "/templates/t1",
        meta: "6 упражнений",
      },
    ]);
  });

  it("href points at the template start screen, not the new-template builder", () => {
    const [row] = buildStrengthTemplateRows([tpl({ id: "abc-123" })]);
    expect(row.href).toBe("/templates/abc-123");
    expect(row.href).not.toBe("/templates/new");
  });

  it("preserves input order (repo already sorts by freshness)", () => {
    const rows = buildStrengthTemplateRows([
      tpl({ id: "a", name: "A" }),
      tpl({ id: "b", name: "B" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("buildCircuitTemplateRows", () => {
  const tpl = (over: Partial<TemplateListSource> = {}): TemplateListSource => ({
    id: "c1",
    name: "Кор-круг",
    description: null,
    exerciseCount: 4,
    updatedAt: new Date("2026-06-12T00:00:00Z"),
    ...over,
  });

  it("returns [] for no templates (R-37 empty → builder, not phantom list)", () => {
    expect(buildCircuitTemplateRows([])).toEqual([]);
  });

  it("maps id, name and pluralized exercise meta WITHOUT href (started via action)", () => {
    expect(buildCircuitTemplateRows([tpl()])).toEqual([
      { id: "c1", name: "Кор-круг", meta: "4 упражнения" },
    ]);
  });

  it("omits href — circuit starts via POST action, not a /templates/[id] link", () => {
    const [row] = buildCircuitTemplateRows([tpl()]);
    expect(row.href).toBeUndefined();
  });

  it("preserves input order (repo already sorts by freshness)", () => {
    const rows = buildCircuitTemplateRows([
      tpl({ id: "a", name: "A" }),
      tpl({ id: "b", name: "B" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("buildCardioTemplateRows", () => {
  const tpl = (
    over: Partial<CardioTemplateListSource> = {},
  ): CardioTemplateListSource => ({
    id: "cd1",
    name: "Утренний HIIT",
    description: null,
    metaLine: "Свой · 6×30/60с",
    updatedAt: new Date("2026-06-12T00:00:00Z"),
    ...over,
  });

  it("returns [] for no templates (R-37 empty → builder, not phantom list)", () => {
    expect(buildCardioTemplateRows([])).toEqual([]);
  });

  it("maps id, name and interval meta WITHOUT href (started via action)", () => {
    expect(buildCardioTemplateRows([tpl()])).toEqual([
      { id: "cd1", name: "Утренний HIIT", meta: "Свой · 6×30/60с" },
    ]);
  });

  it("omits href — cardio starts via POST action, not a /templates/[id] link", () => {
    const [row] = buildCardioTemplateRows([tpl()]);
    expect(row.href).toBeUndefined();
  });

  it("preserves input order (repo already sorts by freshness)", () => {
    const rows = buildCardioTemplateRows([
      tpl({ id: "a", name: "A" }),
      tpl({ id: "b", name: "B" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
