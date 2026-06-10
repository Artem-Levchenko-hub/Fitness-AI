import { CalendarClock, ChevronLeft, Dumbbell, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listSchedules } from "@/lib/repos/schedule.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { formatDays, formatHour } from "@/lib/ui/weekdays";
import {
  deleteScheduleAction,
  toggleScheduleAction,
} from "@/server/actions/schedule";

import { ScheduleForm } from "./schedule-form";

export const metadata: Metadata = { title: "Расписание тренировок" };

/** Резолв привязанной заготовки расписания → имя для отображения. Заготовка
 *  старше выборки (или удалена → FK SET NULL) даёт фолбэк по формату. */
function resolvePresetLabel(
  s: { templateId: string | null; circuitWorkoutId: string | null; cardioWorkoutId: string | null },
  names: Map<string, string>,
): string | null {
  if (s.templateId)
    return names.get(`template:${s.templateId}`) ?? "Силовая заготовка";
  if (s.circuitWorkoutId)
    return names.get(`circuit:${s.circuitWorkoutId}`) ?? "Круговая";
  if (s.cardioWorkoutId)
    return names.get(`cardio:${s.cardioWorkoutId}`) ?? "Кардио";
  return null;
}

export default async function SchedulePage() {
  const user = await requireUser();
  const [schedules, templates, circuits, cardio] = await Promise.all([
    listSchedules(user.id),
    listTemplates(user.id),
    listCircuits(user.id),
    listRecentCardio(user.id),
  ]);

  const templateOpts = templates.map((t) => ({
    value: `template:${t.id}`,
    label: t.name,
  }));
  const circuitOpts = circuits.map((c) => ({
    value: `circuit:${c.id}`,
    label: c.name,
  }));
  const cardioOpts = cardio.map((c) => ({
    value: `cardio:${c.id}`,
    label: c.name,
  }));

  // Индекс "kind:id" → имя для отображения связанной заготовки в списке.
  const presetNames = new Map<string, string>([
    ...templateOpts.map((o) => [o.value, o.label] as const),
    ...circuitOpts.map((o) => [o.value, o.label] as const),
    ...cardioOpts.map((o) => [o.value, o.label] as const),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/settings">
          <ChevronLeft className="size-4" />
          Настройки
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Напоминания
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Расписание тренировок
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Выберите дни и время — приложение напомнит, что пора тренироваться.
        </p>
      </header>

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Новое расписание
        </h2>
        <ScheduleForm
          presetGroups={{
            templates: templateOpts,
            circuits: circuitOpts,
            cardio: cardioOpts,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Ваши расписания
        </h2>

        {schedules.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
            <CalendarClock className="size-7 opacity-60" aria-hidden="true" />
            <p className="text-sm">
              Пока нет расписаний. Добавьте первое выше — и тренировки войдут в
              привычку.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {schedules.map((s) => (
              <li
                key={s.id}
                className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {s.label}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDays(s.daysOfWeek)} · {formatHour(s.hour)}
                  </p>
                  {resolvePresetLabel(s, presetNames) ? (
                    <p className="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium">
                      <Dumbbell className="size-3" aria-hidden="true" />
                      {resolvePresetLabel(s, presetNames)}
                    </p>
                  ) : null}
                  {!s.enabled ? (
                    <span className="text-muted-foreground/70 mt-1 inline-block text-[11px] font-medium tracking-wide uppercase">
                      Выключено
                    </span>
                  ) : null}
                </div>

                <form action={toggleScheduleAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={s.enabled ? "false" : "true"}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    {s.enabled ? "Выключить" : "Включить"}
                  </Button>
                </form>

                <form action={deleteScheduleAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label={`Удалить расписание «${s.label}»`}
                  >
                    <Trash2 className="text-muted-foreground size-4" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
