import { describe, expect, it } from "vitest";

import { mergeTemplateList } from "./template-list";

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
