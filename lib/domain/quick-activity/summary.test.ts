import { describe, expect, it } from "vitest";

import { summarizeQuickDay, type QuickDayEntry } from "./summary";

const e = (
  exerciseName: string,
  mode: "sets" | "total" | "myo_reps",
  reps: number,
  extra: Partial<QuickDayEntry> = {},
): QuickDayEntry => ({ exerciseName, mode, reps, ...extra });

describe("summarizeQuickDay", () => {
  it("пустой день → пустая сводка", () => {
    expect(summarizeQuickDay([])).toEqual([]);
  });

  it("подходы одного упражнения сливаются в хронологию через «+»", () => {
    // repo отдаёт по убыванию свежести: последний подход (8) первым.
    const out = summarizeQuickDay([
      e("Подтягивания", "sets", 8),
      e("Подтягивания", "sets", 10),
      e("Подтягивания", "sets", 12),
    ]);
    expect(out).toEqual([
      {
        exerciseName: "Подтягивания",
        detail: "12+10+8",
        totalReps: 30,
        entries: 3,
      },
    ]);
  });

  it("одиночный тотал — просто число", () => {
    const out = summarizeQuickDay([e("Эспандер кистевой", "total", 100)]);
    expect(out[0]).toMatchObject({ detail: "100", totalReps: 100, entries: 1 });
  });

  it("группы идут по свежести: последнее упражнение — первым", () => {
    const out = summarizeQuickDay([
      e("Эспандер кистевой", "total", 100), // свежайшая запись
      e("Подтягивания", "sets", 10),
    ]);
    expect(out.map((g) => g.exerciseName)).toEqual([
      "Эспандер кистевой",
      "Подтягивания",
    ]);
  });

  it("два тотала одного упражнения складываются и показываются через «+»", () => {
    const out = summarizeQuickDay([
      e("Эспандер кистевой", "total", 50),
      e("Эспандер кистевой", "total", 100),
    ]);
    expect(out[0]).toMatchObject({ detail: "100+50", totalReps: 150 });
  });

  it("одиночный myo-кластер показывает структуру активация+мини", () => {
    const out = summarizeQuickDay([
      e("Разгибание рук", "myo_reps", 21, {
        myoActivationReps: 12,
        myoMiniSets: 3,
        myoMiniReps: 3,
      }),
    ]);
    expect(out[0]).toMatchObject({
      detail: "12+3×3",
      totalReps: 21,
      entries: 1,
    });
  });
});
