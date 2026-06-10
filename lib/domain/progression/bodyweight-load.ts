export type SetForBodyweight = { weightKg: number };

export type BodyweightLoad = {
  /** Эффективная нагрузка top-set: вес тела + максимальная добавка. */
  effectiveKg: number;
  /** Максимальная добавка (введённый вес) среди подходов. */
  addedKg: number;
  /** Доля добавки в эффективной нагрузке, % (округлено). */
  pct: number;
};

/** Для bodyweight-упражнений (подтягивания, брусья, отжимания) введённый
 *  `weightKg` = ДОБАВКА сверх веса тела. Реальная нагрузка = вес тела + добавка.
 *  Снижение добавки 20→10 кг у атлета 90 кг = малый % тотала, не сильный регресс.
 *  Считает по top-set (максимальная добавка). null если нет подходов или нет
 *  валидного веса тела. */
export function bodyweightEffectiveLoad(
  bodyweightKg: number,
  sets: ReadonlyArray<SetForBodyweight>,
): BodyweightLoad | null {
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;
  if (sets.length === 0) return null;

  const addedKg = Math.max(0, ...sets.map((s) => s.weightKg));
  const effectiveKg = bodyweightKg + addedKg;
  const pct = Math.round((addedKg / effectiveKg) * 100);
  return { effectiveKg, addedKg, pct };
}
