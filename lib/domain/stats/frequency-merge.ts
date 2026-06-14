/** Календарная активность объединяет ВСЕ форматы тренировок (силовые +
 *  круговые + кардио). Каждый формат живёт в своей таблице → репо делает
 *  по запросу на формат с одинаковым ключом дня (день в TZ юзера,
 *  'YYYY-MM-DD'), а это — чистое слияние их посуточных счётчиков.
 *
 *  Чистая доменная логика (R-7): без db/React → node-юнит-тестируема. Так
 *  heatmap «Активность» на /stats показывает день, когда была ЛЮБАЯ
 *  тренировка, а не только силовая (как и счётчик WeekCard дашборда после
 *  H12.0). */
export type DailyCount = {
  date: string;
  count: number;
};

/** Сливает посуточные счётчики из нескольких источников в один список:
 *  одинаковая дата из разных форматов суммируется; результат отсортирован
 *  по дате по возрастанию. Пустые источники игнорируются. */
export function mergeDailyFrequency(sources: DailyCount[][]): DailyCount[] {
  const byDate = new Map<string, number>();
  for (const source of sources) {
    for (const { date, count } of source) {
      byDate.set(date, (byDate.get(date) ?? 0) + count);
    }
  }
  return [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
