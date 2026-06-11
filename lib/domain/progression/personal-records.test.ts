import { describe, expect, it } from "vitest";

import { checkPersonalRecord, type PRSet } from "./personal-records";

/** Характеризационные тесты PR-детекции (G5). Фиксируют контракт, на который
 *  опираются PR-бейджи и AI-разбор: что считается рекордом, как фильтруется
 *  история (по упражнению и по времени), и когда прирост помечается
 *  подозрительным. Подходы reps=1 → оценочный 1RM = вес (короткое замыкание в
 *  estimatedOneRepMax), поэтому дельты считаются точно. */

const SQUAT = "squat";
const BENCH = "bench";
const T0 = new Date("2026-06-01T10:00:00Z");
const T1 = new Date("2026-06-08T10:00:00Z");

function set(
  exerciseId: string,
  weightKg: number,
  reps: number,
  completedAt: Date,
): PRSet {
  return { exerciseId, weightKg, reps, completedAt };
}

describe("checkPersonalRecord", () => {
  it("первый подход без истории → новый PR, база = 0, прирост = весь 1RM", () => {
    const r = checkPersonalRecord(set(SQUAT, 80, 1, T1), []);
    expect(r.isNewPR).toBe(true);
    expect(r.previousBestOneRepMaxKg).toBe(0);
    expect(r.candidateOneRepMaxKg).toBe(80);
    expect(r.improvementKg).toBe(80);
    expect(r.suspicious).toBe(false); // нет базы → не флагуем
  });

  it("вес выше прошлого лучшего → новый PR с положительным приростом", () => {
    const history = [set(SQUAT, 100, 1, T0)];
    const r = checkPersonalRecord(set(SQUAT, 105, 1, T1), history);
    expect(r.isNewPR).toBe(true);
    expect(r.previousBestOneRepMaxKg).toBe(100);
    expect(r.candidateOneRepMaxKg).toBe(105);
    expect(r.improvementKg).toBe(5);
    expect(r.suspicious).toBe(false); // +5кг < порог 10кг
  });

  it("равный прошлому лучшему → НЕ PR (строгое >)", () => {
    const history = [set(SQUAT, 100, 1, T0)];
    const r = checkPersonalRecord(set(SQUAT, 100, 1, T1), history);
    expect(r.isNewPR).toBe(false);
    expect(r.improvementKg).toBe(0);
  });

  it("вес ниже прошлого лучшего → НЕ PR, прирост отрицательный", () => {
    const history = [set(SQUAT, 120, 1, T0)];
    const r = checkPersonalRecord(set(SQUAT, 100, 1, T1), history);
    expect(r.isNewPR).toBe(false);
    expect(r.previousBestOneRepMaxKg).toBe(120);
    expect(r.improvementKg).toBe(-20);
  });

  it("история другого упражнения игнорируется (фильтр по exerciseId)", () => {
    const history = [set(BENCH, 200, 1, T0)];
    const r = checkPersonalRecord(set(SQUAT, 100, 1, T1), history);
    expect(r.previousBestOneRepMaxKg).toBe(0); // bench не учитывается
    expect(r.isNewPR).toBe(true);
  });

  it("запись с completedAt == кандидату исключается (дедуп кандидата в истории)", () => {
    // тот же instant → кандидат может присутствовать в history, отфильтровать
    const history = [set(SQUAT, 200, 1, T1)];
    const r = checkPersonalRecord(set(SQUAT, 100, 1, T1), history);
    expect(r.previousBestOneRepMaxKg).toBe(0); // >= candidate.completedAt отброшен
    expect(r.isNewPR).toBe(true);
  });

  it("будущая запись (completedAt позже кандидата) не учитывается в базе", () => {
    const future = new Date("2026-07-01T10:00:00Z");
    const history = [set(SQUAT, 200, 1, future)];
    const r = checkPersonalRecord(set(SQUAT, 100, 1, T1), history);
    expect(r.previousBestOneRepMaxKg).toBe(0);
    expect(r.isNewPR).toBe(true);
  });

  it("неправдоподобный скачок (+50кг, кейс владельца G5) → suspicious=true", () => {
    const history = [set(SQUAT, 100, 1, T0)];
    const r = checkPersonalRecord(set(SQUAT, 150, 1, T1), history);
    expect(r.isNewPR).toBe(true);
    expect(r.improvementKg).toBe(50);
    expect(r.suspicious).toBe(true);
  });

  it("чистый bodyweight (вес 0) → 1RM=0 → НЕ weight-PR даже без истории", () => {
    const r = checkPersonalRecord(set(SQUAT, 0, 10, T1), []);
    expect(r.candidateOneRepMaxKg).toBe(0);
    expect(r.isNewPR).toBe(false);
    expect(r.improvementKg).toBe(0);
    expect(r.suspicious).toBe(false);
  });

  it("многоповторный подход усредняет Epley+Brzycki (путь усреднения)", () => {
    // 100кг×5: epley=116.667, brzycki=112.5 → среднее ≈ 114.583
    const r = checkPersonalRecord(set(SQUAT, 100, 5, T1), []);
    expect(r.candidateOneRepMaxKg).toBeCloseTo(114.583, 2);
    expect(r.isNewPR).toBe(true);
  });

  it("из нескольких прошлых подходов берётся максимальный 1RM как база", () => {
    const history = [
      set(SQUAT, 90, 1, T0),
      set(SQUAT, 110, 1, T0),
      set(SQUAT, 80, 1, T0),
    ];
    const r = checkPersonalRecord(set(SQUAT, 120, 1, T1), history);
    expect(r.previousBestOneRepMaxKg).toBe(110); // максимум, не последний
    expect(r.improvementKg).toBe(10);
    expect(r.isNewPR).toBe(true);
  });
});
