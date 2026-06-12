/** Самая «горячая» группа мышц — наибольший нагрев. Цель одноразового
 *  аффорданса H6.5 (микро-пульс до первого тапа): подсвечиваем самую нагруженную
 *  группу, чтобы направить первый тап в аватар. Чистый модуль (R-7) — берёт
 *  готовый нагрев (t/sets из muscleHeatProfile), ничего не пересчитывает (R-04). */

type HeatLike = { key: string; t: number; sets: number };

/** Ключ группы с максимальным нагревом (t). Тай-брейк: больше подходов, затем
 *  порядок входа. null, если ни одна группа не тренировалась (все t<=0) —
 *  пульсировать нечего (серый аватар у новичка/кардио-юзера). */
export function hottestMuscleKey(data: ReadonlyArray<HeatLike>): string | null {
  let best: HeatLike | null = null;
  for (const d of data) {
    if (d.t <= 0) continue;
    if (best === null || d.t > best.t || (d.t === best.t && d.sets > best.sets)) {
      best = d;
    }
  }
  return best ? best.key : null;
}
