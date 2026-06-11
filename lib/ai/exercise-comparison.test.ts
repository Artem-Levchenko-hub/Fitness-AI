import { describe, expect, it } from "vitest";

import { formatExerciseComparison } from "./exercise-comparison";

/** Покрытие per-упражнение блока «сравнение с прошлым» для AI-контекста (H5.3):
 *  прошлая сессия set-by-set + тренд e1RM (reuse formatOneRmTrend) + дистанция
 *  до личного рекорда (новый PR / отставание / первый замер). */
describe("formatExerciseComparison", () => {
  it("новый PR: сегодня e1RM ≥ лучшего за всё время → строка с 🏆", () => {
    const out = formatExerciseComparison({
      nameRu: "Жим лёжа",
      trend: { nameRu: "Жим лёжа", todayKg: 92.8, previousKg: 85 },
      previousSession: {
        dateLabel: "05 июн 2026",
        sets: [
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
        ],
      },
      allTimeBestE1rm: 90,
    });
    expect(out).toContain("## Жим лёжа");
    expect(out).toContain("прошлая сессия (05 июн 2026): 80×5, 80×5");
    expect(out).toContain("85.0 → 92.8 kg");
    expect(out).toContain("🏆 новый личный рекорд e1RM 92.8 kg");
    expect(out).toContain("прошлый лучший 90.0 kg");
    expect(out).toContain("+2.8");
  });

  it("отставание от PR: сегодня ниже лучшего → дистанция в kg и %", () => {
    const out = formatExerciseComparison({
      nameRu: "Присед",
      trend: { nameRu: "Присед", todayKg: 90, previousKg: 95 },
      previousSession: {
        dateLabel: "01 июн 2026",
        sets: [{ weightKg: 100, reps: 5 }],
      },
      allTimeBestE1rm: 100,
    });
    expect(out).toContain("прошлая сессия (01 июн 2026): 100×5");
    expect(out).toContain("до личного рекорда e1RM 100.0 kg: −10.0 kg");
    expect(out).toContain("10.0% ниже PR");
  });

  it("первый замер: нет лучшего за всё время (null) → первый зафиксированный", () => {
    const out = formatExerciseComparison({
      nameRu: "Тяга",
      trend: { nameRu: "Тяга", todayKg: 120, previousKg: null },
      previousSession: null,
      allTimeBestE1rm: null,
    });
    expect(out).toContain("прошлых сессий этого упражнения нет (первый раз)");
    expect(out).toContain("сегодня e1RM 120.0 kg (нет прошлых данных)");
    expect(out).toContain("рекорд: первый зафиксированный e1RM (120.0 kg)");
  });

  it("прошлая сессия есть, но PR недостижим (allTimeBest 0) трактуется как первый", () => {
    const out = formatExerciseComparison({
      nameRu: "Жим",
      trend: { nameRu: "Жим", todayKg: 60, previousKg: 58 },
      previousSession: {
        dateLabel: "10 июн 2026",
        sets: [{ weightKg: 55, reps: 6 }],
      },
      allTimeBestE1rm: 0,
    });
    expect(out).toContain("прошлая сессия (10 июн 2026): 55×6");
    expect(out).toContain("рекорд: первый зафиксированный e1RM (60.0 kg)");
  });

  it("сегодня ровно равно PR → трактуется как новый рекорд (>=), дельта +0.0", () => {
    const out = formatExerciseComparison({
      nameRu: "Жим",
      trend: { nameRu: "Жим", todayKg: 100, previousKg: 100 },
      previousSession: { dateLabel: "08 июн 2026", sets: [{ weightKg: 90, reps: 8 }] },
      allTimeBestE1rm: 100,
    });
    expect(out).toContain("🏆 новый личный рекорд e1RM 100.0 kg");
    expect(out).toContain("+0.0");
  });

  it("несёт G5-флаг тренда (подозрительный скачок) через reuse formatOneRmTrend", () => {
    const out = formatExerciseComparison({
      nameRu: "Жим",
      trend: { nameRu: "Жим", todayKg: 130, previousKg: 100 },
      previousSession: { dateLabel: "02 июн 2026", sets: [{ weightKg: 95, reps: 5 }] },
      allTimeBestE1rm: 110,
    });
    expect(out).toContain("⚠️ ПОДОЗРИТЕЛЬНЫЙ СКАЧОК");
  });
});
