/** Дисциплина расписания: «план vs факт» для AI-тренера.
 *
 *  Чистая логика (R-7): tz-математика (локальная дата + ISO-день недели) делается
 *  ВЫШЕ — вызывающий передаёт уже посчитанные day-cells. Здесь только
 *  сопоставление «день недели входит в расписание» × «была ли тренировка».
 *
 *  Гранулярность — ДЕНЬ: день считается запланированным, если в его ISO-день
 *  недели срабатывает ≥1 расписание; выполненным — если в этот календарный день
 *  была хотя бы одна завершённая сессия любого формата (силовая/круговая/кардио).
 *  Тренер рассуждает днями («запланировал 4 тренировки, пропустил пятницу»), а не
 *  отдельными слотами. */

/** Минимум полей расписания, нужный для adherence. */
export type ScheduleLite = {
  label: string;
  /** ISO-дни недели 1=Пн..7=Вс. */
  daysOfWeek: number[];
  hour: number;
};

/** Один календарный день в локальной timezone юзера. */
export type DayCell = {
  /** "YYYY-MM-DD" в timezone юзера. */
  date: string;
  /** ISO-день недели 1=Пн..7=Вс. */
  isoDay: number;
};

/** Запланированная сессия в будущем окне. */
export type PlannedSession = {
  date: string;
  isoDay: number;
  label: string;
  hour: number;
};

export type ScheduleAdherence = {
  /** Дней с ≥1 запланированной сессией за прошлое окно. */
  planned7d: number;
  /** Из запланированных дней — сколько имели завершённую тренировку. */
  done7d: number;
  /** Запланированные дни без тренировки (что пропущено и какие лейблы). */
  missed: Array<{ date: string; isoDay: number; labels: string[] }>;
  /** Запланированные сессии будущего окна (только дни, где что-то стоит). */
  upcoming: PlannedSession[];
};

/** Лейблы расписаний, срабатывающих в данный ISO-день (в порядке schedules). */
function labelsForDay(schedules: ScheduleLite[], isoDay: number): string[] {
  return schedules
    .filter((s) => s.daysOfWeek.includes(isoDay))
    .map((s) => s.label);
}

export function computeScheduleAdherence(
  schedules: ScheduleLite[],
  pastDays: DayCell[],
  upcomingDays: DayCell[],
  completedDates: ReadonlySet<string>,
): ScheduleAdherence {
  let planned7d = 0;
  let done7d = 0;
  const missed: ScheduleAdherence["missed"] = [];

  for (const day of pastDays) {
    const labels = labelsForDay(schedules, day.isoDay);
    if (labels.length === 0) continue; // день не запланирован
    planned7d += 1;
    if (completedDates.has(day.date)) {
      done7d += 1;
    } else {
      missed.push({ date: day.date, isoDay: day.isoDay, labels });
    }
  }

  const upcoming: PlannedSession[] = [];
  for (const day of upcomingDays) {
    for (const s of schedules) {
      if (s.daysOfWeek.includes(day.isoDay)) {
        upcoming.push({
          date: day.date,
          isoDay: day.isoDay,
          label: s.label,
          hour: s.hour,
        });
      }
    }
  }

  return { planned7d, done7d, missed, upcoming };
}
