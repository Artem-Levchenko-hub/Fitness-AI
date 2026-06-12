import { describe, expect, it } from "vitest";

import { topMuscleRecords, type MuscleRecordRow } from "./muscle-records";

function row(
  muscleKey: string,
  exerciseId: string,
  name: string,
  weightKg: number,
  reps: number,
): MuscleRecordRow {
  return { muscleKey, exerciseId, name, weightKg, reps };
}

describe("topMuscleRecords", () => {
  it("keeps the heaviest (by e1RM) set per exercise", () => {
    const out = topMuscleRecords([
      row("chest", "bench", "Жим лёжа", 80, 5),
      row("chest", "bench", "Жим лёжа", 100, 5), // PR
      row("chest", "bench", "Жим лёжа", 90, 3),
    ]);
    const chest = out.get("chest")!;
    expect(chest).toHaveLength(1);
    expect(chest[0]).toMatchObject({ weightKg: 100, reps: 5 });
  });

  it("groups multiple exercises under one muscle, sorted by e1RM desc", () => {
    const out = topMuscleRecords([
      row("chest", "bench", "Жим лёжа", 100, 5),
      row("chest", "dip", "Отжимания на брусьях", 40, 8),
      row("chest", "fly", "Разведения", 20, 12),
    ]);
    const chest = out.get("chest")!;
    expect(chest.map((r) => r.name)).toEqual([
      "Жим лёжа",
      "Отжимания на брусьях",
      "Разведения",
    ]);
  });

  it("respects the limit", () => {
    const out = topMuscleRecords(
      [
        row("back_lats", "a", "A", 100, 5),
        row("back_lats", "b", "B", 90, 5),
        row("back_lats", "c", "C", 80, 5),
        row("back_lats", "d", "D", 70, 5),
      ],
      2,
    );
    expect(out.get("back_lats")).toHaveLength(2);
    expect(out.get("back_lats")!.map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("excludes bodyweight / weightless sets (e1RM = 0)", () => {
    const out = topMuscleRecords([
      row("chest", "pushup", "Отжимания", 0, 30),
    ]);
    expect(out.has("chest")).toBe(false);
  });

  it("separates records by muscle group", () => {
    const out = topMuscleRecords([
      row("chest", "bench", "Жим лёжа", 100, 5),
      row("quads", "squat", "Присед", 140, 5),
    ]);
    expect(out.get("chest")!.map((r) => r.name)).toEqual(["Жим лёжа"]);
    expect(out.get("quads")!.map((r) => r.name)).toEqual(["Присед"]);
  });

  it("returns an empty map for no rows", () => {
    expect(topMuscleRecords([]).size).toBe(0);
  });

  it("attaches an estimated 1RM at least the lifted weight", () => {
    const out = topMuscleRecords([row("chest", "bench", "Жим лёжа", 100, 5)]);
    expect(out.get("chest")![0].e1rm).toBeGreaterThan(100);
  });

  it("carries exerciseId so the record can link to the exercise page", () => {
    const out = topMuscleRecords([row("chest", "bench", "Жим лёжа", 100, 5)]);
    expect(out.get("chest")![0].exerciseId).toBe("bench");
  });
});
