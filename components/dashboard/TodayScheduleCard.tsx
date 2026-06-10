import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { localIsoDay } from "@/lib/datetime/local-day";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listEnabledSchedulesForUser } from "@/lib/repos/schedule.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { reRunCardioAction } from "@/server/actions/cardio";
import { reRunCircuitAction } from "@/server/actions/circuits";
import { startWorkoutFromTemplateAction } from "@/server/actions/workouts";
import type { WorkoutSchedule } from "@/db/schema";

/** Куда ведёт строка «сегодня». G7b: привязанная заготовка стартует ПРЯМО одним
 *  кликом — новый активный сеанс без захода на detail-страницу. Силовая = старт
 *  из шаблона; круговая/кардио (session-instance) = клон плана (re-run). Свободное
 *  расписание (нет привязки) → /create-пикер как раньше (<Link>). */
type StartKind = "template" | "circuit" | "cardio";
type PresetTarget =
  | { kind: StartKind; id: string; presetLabel: string }
  | { kind: "link"; href: string; presetLabel: string | null };

/** Server action + имя hidden-поля для каждого формата прямого старта (R-4 DRY —
 *  рендер строки одинаков, различается только action+поле). */
const START: Record<StartKind, { action: (fd: FormData) => Promise<void>; field: string }> = {
  template: { action: startWorkoutFromTemplateAction, field: "templateId" },
  circuit: { action: reRunCircuitAction, field: "circuitId" },
  cardio: { action: reRunCardioAction, field: "cardioId" },
};

/** Привязка расписания → цель строки. NULL во всех 3 FK = «свободное»: ведём на
 *  /create-пикер (как раньше). Заготовка вне выборки/удалена (FK SET NULL) →
 *  фолбэк-метка по формату. */
function resolvePreset(
  s: WorkoutSchedule,
  names: Map<string, string>,
): PresetTarget {
  if (s.templateId)
    return {
      kind: "template",
      id: s.templateId,
      presetLabel: names.get(`template:${s.templateId}`) ?? "Силовая заготовка",
    };
  if (s.circuitWorkoutId)
    return {
      kind: "circuit",
      id: s.circuitWorkoutId,
      presetLabel: names.get(`circuit:${s.circuitWorkoutId}`) ?? "Круговая",
    };
  if (s.cardioWorkoutId)
    return {
      kind: "cardio",
      id: s.cardioWorkoutId,
      presetLabel: names.get(`cardio:${s.cardioWorkoutId}`) ?? "Кардио",
    };
  return { kind: "link", href: "/create", presetLabel: null };
}

/** Общий вид строки (R-4 DRY — одинаков для <form>-кнопки и <Link>). ≥56px (R-41). */
const ROW_CLASS =
  "bg-card border-border hover:border-primary/40 flex min-h-[56px] w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors";

/** Внутренности строки: заголовок расписания + имя заготовки + CTA-стрелка. */
function RowInner({
  label,
  sub,
  cta,
}: {
  label: string;
  sub: string;
  cta: string;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{label}</p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{sub}</p>
      </div>
      <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium">
        {cta}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </>
  );
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

  const items = todays.map((s) => ({ schedule: s, target: resolvePreset(s, names) }));

  return (
    <section className="border-primary/30 bg-primary/5 mb-6 rounded-2xl border p-5">
      <p className="text-primary flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] uppercase">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        Сегодня по расписанию
      </p>

      <ul className="mt-3 space-y-2">
        {items.map(({ schedule, target }) => (
          <li key={schedule.id}>
            {target.kind === "link" ? (
              <Link href={target.href} className={ROW_CLASS}>
                <RowInner
                  label={schedule.label}
                  sub={target.presetLabel ?? "Выбрать формат тренировки"}
                  cta={target.presetLabel ? "Начать" : "Выбрать"}
                />
              </Link>
            ) : (
              // G7b: привязанная заготовка — прямой старт одним кликом (силовая =
              // старт из шаблона, круговая/кардио = клон плана в новый сеанс).
              <form action={START[target.kind].action}>
                <input
                  type="hidden"
                  name={START[target.kind].field}
                  value={target.id}
                />
                <button type="submit" className={ROW_CLASS}>
                  <RowInner
                    label={schedule.label}
                    sub={target.presetLabel}
                    cta="Начать"
                  />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
