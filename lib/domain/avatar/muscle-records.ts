import { estimatedOneRepMax } from "../progression/one-rep-max";

/** Одна сырая запись «лучший working-подход упражнения за всю историю,
 *  задевший группу мышц» — приходит из repo (только primary-роль: рекорд
 *  принадлежит группе, которую упражнение тренирует основной, а не вторичной). */
export type MuscleRecordRow = {
  muscleKey: string;
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
};

/** PR одного упражнения внутри группы: реальный подход-рекорд (вес × повторы)
 *  и его оценочный 1ПМ — для сортировки и подписи. */
export type MuscleRecord = {
  /** id упражнения — чтобы рекорд в панели вёл в историю /exercises/[id]. */
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  /** Оценочный 1ПМ рекордного подхода (кг) — мерило «силы» рекорда. */
  e1rm: number;
};

/** Чистая агрегация рекордов по группам мышц для дрилл-дауна аватара (R-7).
 *  Из плоских строк «подход × группа» оставляет на каждое упражнение ЛУЧШИЙ
 *  подход по оценочному 1ПМ, затем группирует по мышце и возвращает топ-`limit`
 *  упражнений группы (по убыванию 1ПМ). Подходы без веса (bodyweight, reps=0)
 *  дают e1rm=0 и отсеиваются — PR здесь = силовой рекорд с весом. */
export function topMuscleRecords(
  rows: ReadonlyArray<MuscleRecordRow>,
  limit = 3,
): Map<string, MuscleRecord[]> {
  // (muscleKey → (exerciseId → лучший подход)) — дедуп до одного PR на движение.
  const byMuscle = new Map<string, Map<string, MuscleRecord>>();

  for (const r of rows) {
    const e1rm = estimatedOneRepMax(r.weightKg, r.reps);
    if (e1rm <= 0) continue; // bodyweight / битые данные — не силовой рекорд
    let exMap = byMuscle.get(r.muscleKey);
    if (!exMap) {
      exMap = new Map();
      byMuscle.set(r.muscleKey, exMap);
    }
    const prev = exMap.get(r.exerciseId);
    if (!prev || e1rm > prev.e1rm) {
      exMap.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        name: r.name,
        weightKg: r.weightKg,
        reps: r.reps,
        e1rm,
      });
    }
  }

  const result = new Map<string, MuscleRecord[]>();
  for (const [muscleKey, exMap] of byMuscle) {
    const records = Array.from(exMap.values())
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, limit);
    result.set(muscleKey, records);
  }
  return result;
}
