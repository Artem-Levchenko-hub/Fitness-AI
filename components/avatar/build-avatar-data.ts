import { muscleLabel } from "@/components/app/MuscleBadges";
import { forgottenWeeks } from "@/lib/domain/avatar/forgotten";
import { heatColorStop, heatFromSets, heatLabel } from "@/lib/domain/avatar/heat";
import type { MuscleHeat } from "@/lib/repos/stats.repo";

import type { AvatarMuscleDatum } from "./types";

/** Серверный сборщик view-model аватара: подходы за неделю из repo → доменный
 *  нагрев (heatFromSets) → цвет/ярлык/сериализуемые поля для client-компонента.
 *  Общий для своего /profile и профиля друга — единственное место, где
 *  repo-числа превращаются в то, что красит и показывает 3D-аватар. */
export function buildAvatarData(
  heat: MuscleHeat[],
  now: Date,
  records?: Map<
    string,
    Array<{ exerciseId: string; name: string; weightKg: number; reps: number }>
  >,
  /** Всевременная дата последней нагрузки на группу (muscleLastTrained). Только
   *  свой /profile передаёт её — у друга «забытость» не показываем. */
  lastTrained?: Map<string, Date>,
  /** H17.1 — тоннаж группы по ISO-неделям (muscleWeeklyVolume). Только свой
   *  /profile передаёт его; без него шаг «по неделям» пуст (друг/дашборд). */
  weeklyVolume?: Map<string, number[]>,
  /** H18.2 — целевая частота (подходов/нед) на группу (getMuscleGroupGoals).
   *  Только свой /profile; без неё трек-бар цели в панели не рендерится. */
  muscleGoals?: Map<string, number>,
): AvatarMuscleDatum[] {
  return heat.map((m) => {
    const h = heatFromSets(m.weeklySets);
    return {
      key: m.muscleKey,
      label: muscleLabel(m.muscleKey),
      color: heatColorStop(h.t),
      t: h.t,
      level: h.level,
      levelLabel: heatLabel(h.level),
      volume7d: m.volume7d,
      sets: m.sets,
      lastTrainedLabel: formatLastTrained(m.lastTrainedAt, now),
      forgottenWeeks: forgottenWeeks(lastTrained?.get(m.muscleKey) ?? null, now),
      top3: m.top3,
      records: records?.get(m.muscleKey) ?? [],
      weeklyVolume: weeklyVolume?.get(m.muscleKey) ?? [],
      goalTarget: muscleGoals?.get(m.muscleKey) ?? null,
    };
  });
}

/** Есть ли у атлета хоть какая-то история за неделю (для empty-state). */
export function hasTrainingData(heat: MuscleHeat[]): boolean {
  return heat.some((m) => m.sets > 0);
}

function formatLastTrained(d: Date | null, now: Date): string {
  if (!d) return "давно";
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} ${pluralDays(days)} назад`;
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}
