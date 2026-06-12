import type { HeatLevel } from "@/lib/domain/avatar/heat";

/** Данные одной группы мышц для 3D-аватара. Готовятся на сервере
 *  (Server Component) из `muscleHeatProfile` + доменного `heatLevel`, передаются
 *  в client-компонент. Все поля сериализуемы (даты — уже строки-ярлыки), цвет
 *  посчитан доменной рампой — клиент только красит и показывает. */
export type AvatarMuscleDatum = {
  key: string;
  /** RU-название группы (muscleLabel). */
  label: string;
  /** Hex-цвет нагрева (heatColorStop) — серый→красный. */
  color: string;
  /** Позиция на рампе [0,1]: управляет силой свечения (emissive). */
  t: number;
  level: HeatLevel;
  /** Человекочитаемый ярлык уровня (heatLabel). */
  levelLabel: string;
  /** Тоннаж группы за 7 дней (кг·повт). */
  volume7d: number;
  /** Число working-подходов за 7 дней. */
  sets: number;
  /** Готовый ярлык «последняя тренировка» (напр. «3 дня назад», «давно»). */
  lastTrainedLabel: string;
  /** Топ-3 упражнения по вкладу за 7 дней. */
  top3: Array<{ name: string; volume: number }>;
  /** All-time PR-рекорды группы: топ упражнений по 1ПМ с рекордным подходом
   *  (вес × повторы). Пусто, если силовых рекордов с весом нет. */
  records: Array<{ name: string; weightKg: number; reps: number }>;
};
