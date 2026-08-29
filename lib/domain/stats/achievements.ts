import { localDateIso } from "@/lib/datetime/local-day";

export type CalendarMonthBounds = {
  start: string;
  end: string;
  label: string;
};

export type MonthlySummary = {
  month: CalendarMonthBounds;
  workouts: number;
  totalSets: number;
  totalReps: number;
  totalTonnageKg: number;
  pullUpReps: number;
  weightedSquatReps: number;
};

export type AchievementFacts = {
  workouts: number;
  pullUpReps: number;
  benchPressKg: number;
  backSquatKg: number;
  maxWorkoutTonnageT: number;
  totalTonnageT: number;
};

export type AchievementTrack = {
  key: keyof AchievementFacts;
  title: string;
  description: string;
  current: number;
  unit: string;
  levels: readonly number[];
  levelLabels?: Readonly<Record<number, string>>;
  unlocked: number;
  nextTarget: number | null;
  progressPct: number;
};

const TRACKS: ReadonlyArray<
  Omit<AchievementTrack, "current" | "unlocked" | "nextTarget" | "progressPct">
> = [
  {
    key: "maxWorkoutTonnageT",
    title: "Тоннаж за тренировку",
    description: "Лучший тоннаж одной завершённой силовой или круговой сессии",
    unit: "т",
    levels: [1, 10],
    levelLabels: {
      1: "🚗 Автомобиль",
      10: "🐘 Африканский слон",
    },
  },
  {
    key: "totalTonnageT",
    title: "Тоннаж за всё время",
    description: "Суммарная внешняя нагрузка за всё время",
    unit: "т",
    levels: [100, 204, 250, 1_000, 3_000, 5_000, 10_000, 20_000],
    levelLabels: {
      100: "🐋 Синий кит",
      204: "🗽 Статуя Свободы",
      250: "✈️ Boeing 747",
      1_000: "⚖️ Килотонна",
      3_000: "🚀 Сатурн-5",
      5_000: "🛕 Будда Весеннего Храма",
      10_000: "🏛️ Обелиск Вашингтона",
      20_000: "🛢️ Нефтяная платформа",
    },
  },
  {
    key: "pullUpReps",
    title: "Подтягивания",
    description: "Все варианты строгих подтягиваний за всё время",
    unit: "повт.",
    levels: [100, 500, 1_000],
  },
  {
    key: "benchPressKg",
    title: "Жим лёжа",
    description: "Лучший вес в подходе или контрольном тесте",
    unit: "кг",
    levels: [60, 80, 100, 120],
  },
  {
    key: "backSquatKg",
    title: "Присед",
    description: "Лучший вес в подходе или контрольном тесте",
    unit: "кг",
    levels: [80, 100, 140, 180],
  },
  {
    key: "workouts",
    title: "Регулярность",
    description: "Завершённые тренировки всех форматов",
    unit: "трен.",
    levels: [10, 25, 50, 100],
  },
];

export function calendarMonthBounds(
  now: Date,
  timeZone: string,
): CalendarMonthBounds {
  const local = localDateIso(now, timeZone);
  const [year, month] = local.split("-").map(Number);
  const nextYear = month === 12 ? year! + 1 : year!;
  const nextMonth = month === 12 ? 1 : month! + 1;
  const start = `${year}-${pad2(month!)}-01`;
  const end = `${nextYear}-${pad2(nextMonth)}-01`;
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${start}T12:00:00Z`));

  return { start, end, label };
}

export function buildAchievementTracks(
  facts: AchievementFacts,
): AchievementTrack[] {
  return TRACKS.map((track) => {
    const current = Math.max(0, facts[track.key]);
    const unlocked = track.levels.filter((level) => current >= level).length;
    const nextTarget = track.levels.find((level) => current < level) ?? null;
    const progressPct = nextTarget
      ? Math.min(99, Math.floor((current / nextTarget) * 100))
      : 100;
    return { ...track, current, unlocked, nextTarget, progressPct };
  });
}

export function countUnlockedAchievements(
  tracks: readonly AchievementTrack[],
): number {
  return tracks.reduce((total, track) => total + track.unlocked, 0);
}

export function countAchievementLevels(
  tracks: readonly AchievementTrack[],
): number {
  return tracks.reduce((total, track) => total + track.levels.length, 0);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
