import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { localIsoDay } from "@/lib/datetime/local-day";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listEnabledSchedulesForUser } from "@/lib/repos/schedule.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import type { WorkoutSchedule } from "@/db/schema";

/** Привязка расписания → куда вести и как назвать заготовку. NULL во всех 3
 *  FK = «свободное» расписание: ведём на /create-пикер (как раньше), без имени.
 *  Заготовка вне выборки/удалена (FK SET NULL) → фолбэк-метка по формату. */
function resolvePreset(
  s: WorkoutSchedule,
  names: Map<string, string>,
): { href: string; presetLabel: string | null } {
  if (s.templateId)
    return {
      href: `/templates/${s.templateId}`,
      presetLabel: names.get(`template:${s.templateId}`) ?? "Силовая заготовка",
    };
  if (s.circuitWorkoutId)
    return {
      href: `/circuits/${s.circuitWorkoutId}`,
      presetLabel: names.get(`circuit:${s.circuitWorkoutId}`) ?? "Круговая",
    };
  if (s.cardioWorkoutId)
    return {
      href: `/cardio/${s.cardioWorkoutId}`,
      presetLabel: names.get(`cardio:${s.cardioWorkoutId}`) ?? "Кардио",
    };
  return { href: "/create", presetLabel: null };
}

/** G7a: подсветка «сегодня надо вот эту» на дашборде. Берёт включённые
 *  расписания юзера, чьи дни недели включают сегодняшний ISO-день в его
 *  локальной TZ, и ведёт прямо на привязанную заготовку (или /create-пикер,
 *  если расписание свободное). Нет расписаний на сегодня → ничего не рисуем. */
export async function TodayScheduleCard({ userId }: { userId: string }) {
  const [profile, schedules, templates, circuits, cardio] = await Promise.all([
    getUserProfile(userId),
    listEnabledSchedulesForUser(userId),
    listTemplates(userId),
    listCircuits(userId),
    listRecentCardio(userId),
  ]);

  const tz = profile?.timezone ?? "Europe/Moscow";
  const todayIso = localIsoDay(new Date(), tz);
  const todays = schedules.filter((s) => s.daysOfWeek.includes(todayIso));
  if (todays.length === 0) return null;

  // Индекс "kind:id" → имя заготовки (как на /schedule).
  const names = new Map<string, string>([
    ...templates.map((t) => [`template:${t.id}`, t.name] as const),
    ...circuits.map((c) => [`circuit:${c.id}`, c.name] as const),
    ...cardio.map((c) => [`cardio:${c.id}`, c.name] as const),
  ]);

  const items = todays.map((s) => ({ schedule: s, ...resolvePreset(s, names) }));

  return (
    <section className="border-primary/30 bg-primary/5 mb-6 rounded-2xl border p-5">
      <p className="text-primary flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] uppercase">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        Сегодня по расписанию
      </p>

      <ul className="mt-3 space-y-2">
        {items.map(({ schedule, href, presetLabel }) => (
          <li key={schedule.id}>
            <Link
              href={href}
              className="bg-card border-border hover:border-primary/40 flex min-h-[56px] items-center gap-3 rounded-xl border p-4 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {schedule.label}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {presetLabel ?? "Выбрать формат тренировки"}
                </p>
              </div>
              <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                {presetLabel ? "Начать" : "Выбрать"}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
