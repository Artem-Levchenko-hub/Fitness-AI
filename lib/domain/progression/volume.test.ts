import { describe, expect, it } from "vitest";

import {
  distributeVolumeByMuscle,
  mergeMuscleVolumes,
  setVolume,
  totalVolume,
  type SetForVolume,
} from "./volume";

// Характеризационные тесты: фиксируют ТЕКУЩИЙ контракт объёмных расчётов.
// totalVolume питает AI-контекст (context-builder) и графики /stats —
// любой будущий рефактор фильтра working-подходов / коэффициентов мышц ловится здесь.

describe("setVolume", () => {
  it("вес × повторы", () => {
    expect(setVolume({ weightKg: 60, reps: 5 })).toBe(300);
  });

  it("нулевой вес (bodyweight без добавки) → 0", () => {
    expect(setVolume({ weightKg: 0, reps: 10 })).toBe(0);
  });
});

describe("totalVolume", () => {
  it("суммирует working-подходы", () => {
    const sets: SetForVolume[] = [
      { weightKg: 60, reps: 5, setType: "working" },
      { weightKg: 80, reps: 3, setType: "working" },
    ];
    expect(totalVolume(sets)).toBe(300 + 240);
  });

  it("подход БЕЗ setType учитывается (undefined проходит фильтр)", () => {
    // KEY: фильтр `s.setType && s.setType !== "working"` пропускает undefined →
    // подходы без явного типа считаются как рабочие (так приходят strength/AI-сеты).
    expect(totalVolume([{ weightKg: 100, reps: 2 }])).toBe(200);
  });

  it("warmup / drop / failure исключаются из тоннажа", () => {
    const sets: SetForVolume[] = [
      { weightKg: 60, reps: 5, setType: "working" }, // 300
      { weightKg: 20, reps: 10, setType: "warmup" }, // исключён
      { weightKg: 40, reps: 8, setType: "drop" }, // исключён
      { weightKg: 50, reps: 1, setType: "failure" }, // исключён
    ];
    expect(totalVolume(sets)).toBe(300);
  });

  it("пустой список → 0", () => {
    expect(totalVolume([])).toBe(0);
  });
});

describe("distributeVolumeByMuscle", () => {
  const sets: SetForVolume[] = [{ weightKg: 60, reps: 5, setType: "working" }]; // total = 300

  it("primary получает 1.0, secondary — 0.5 от тоннажа", () => {
    const r = distributeVolumeByMuscle(sets, [
      { key: "chest", role: "primary" },
      { key: "triceps", role: "secondary" },
    ]);
    expect(r).toEqual({ chest: 300, triceps: 150 });
  });

  it("одна группа и primary, и secondary → коэффициенты складываются (1.5)", () => {
    const r = distributeVolumeByMuscle(sets, [
      { key: "back_lats", role: "primary" },
      { key: "back_lats", role: "secondary" },
    ]);
    expect(r).toEqual({ back_lats: 450 });
  });

  it("нет мышц → пустой объект", () => {
    expect(distributeVolumeByMuscle(sets, [])).toEqual({});
  });

  it("нулевой тоннаж (нет working-подходов) → нули по группам", () => {
    const r = distributeVolumeByMuscle([{ weightKg: 20, reps: 10, setType: "warmup" }], [
      { key: "chest", role: "primary" },
    ]);
    expect(r).toEqual({ chest: 0 });
  });
});

describe("mergeMuscleVolumes", () => {
  it("складывает значения по совпадающим ключам, объединяет разные", () => {
    const r = mergeMuscleVolumes([
      { chest: 300, triceps: 150 },
      { chest: 200, shoulders: 100 },
    ]);
    expect(r).toEqual({ chest: 500, triceps: 150, shoulders: 100 });
  });

  it("пустой массив частей → пустой объект", () => {
    expect(mergeMuscleVolumes([])).toEqual({});
  });

  it("части с пустыми объектами не влияют на результат", () => {
    expect(mergeMuscleVolumes([{}, { quads: 400 }, {}])).toEqual({ quads: 400 });
  });
});
