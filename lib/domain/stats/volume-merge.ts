/** Точка объёма за один бакет (день или ISO-неделя) — общая для силовых и
 *  круговых. `key` = строковый ключ бакета ('YYYY-MM-DD' дня или понедельника
 *  недели в TZ юзера), одинаковый у обоих форматов → их можно слить. */
export type VolumeBucket = {
  key: string;
  volume: number;
  sets: number;
  reps: number;
};

/** Сливает объём по бакетам из нескольких форматов в одну серию: одинаковый
 *  ключ суммируется (тоннаж+подходы+повторы), результат отсортирован по ключу
 *  по возрастанию. Bodyweight-круговая добавляет подходы/повторы при нулевом
 *  тоннаже (честно). Чистая логика (R-7) — node-юнит-тест; не мутирует вход.
 *  Зеркалит mergeDailyFrequency, но переносит три метрики вместо счётчика. */
export function mergeVolumeBuckets(sources: VolumeBucket[][]): VolumeBucket[] {
  const byKey = new Map<string, VolumeBucket>();
  for (const source of sources) {
    for (const b of source) {
      const cur = byKey.get(b.key);
      if (cur) {
        cur.volume += b.volume;
        cur.sets += b.sets;
        cur.reps += b.reps;
      } else {
        byKey.set(b.key, { key: b.key, volume: b.volume, sets: b.sets, reps: b.reps });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
