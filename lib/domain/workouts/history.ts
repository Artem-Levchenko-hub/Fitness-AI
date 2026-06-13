import { isoWeekStartIso } from "@/lib/datetime/iso-week";
import type { CardioPresetKind } from "@/lib/domain/cardio/presets";
import type { CardioSummary } from "@/lib/repos/cardio.repo";
import type { CircuitSummary } from "@/lib/repos/circuits.repo";
import type { RecentWorkout } from "@/lib/repos/workouts.repo";

/** Единая история: силовые + круговые + кардио в одном списке. Каждый формат
 *  ведёт в свой detail-роут и показывает свои метрики; общая оболочка
 *  (дата · формат · название). Питает /workouts (вся история по неделям) и
 *  дашборд («Недавние» / «Последняя») — один поток вместо трёх разрозненных
 *  списков по типу.
 *
 *  Чистая доменная логика слияния (R-7): тип + сборщик живут здесь, без
 *  React/next — поэтому покрыты node-юнит-тестами. View
 *  `components/workouts/workout-history.tsx` реэкспортит их и рисует. */
export type HistoryItem =
  | {
      kind: "strength";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      setCount: number;
      tonnageKg: number;
      hasAnalysis: boolean;
    }
  | {
      kind: "circuit";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      totalRounds: number;
      exerciseCount: number;
      hasAnalysis: boolean;
    }
  | {
      kind: "cardio";
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      preset: CardioPresetKind;
      totalActualSec: number;
      totalPlannedSec: number;
      hrAvg: number | null;
    };

/** Сливает три источника в один хронологический список (новые сверху),
 *  оставляя только завершённые сессии. Брошенные (active) и отменённые
 *  (cancelled) в поток не попадают — он строится РОВНО по completed, как и
 *  графики /stats (G1) и баннеры активных сессий живут отдельно (G2). */
export function buildHistory(
  strength: RecentWorkout[],
  circuits: CircuitSummary[],
  cardio: CardioSummary[],
): HistoryItem[] {
  const items: HistoryItem[] = [
    ...strength
      .filter((w) => w.status === "completed")
      .map((w): HistoryItem => ({ kind: "strength", ...w })),
    ...circuits
      .filter((c) => c.status === "completed")
      .map(
        (c): HistoryItem => ({
          kind: "circuit",
          id: c.id,
          name: c.name,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
          totalRounds: c.totalRounds,
          exerciseCount: c.exerciseCount,
          hasAnalysis: c.hasAnalysis,
        }),
      ),
    ...cardio
      .filter((c) => c.status === "completed")
      .map(
        (c): HistoryItem => ({
          kind: "cardio",
          id: c.id,
          name: c.name,
          startedAt: c.startedAt,
          finishedAt: c.finishedAt,
          preset: c.preset,
          totalActualSec: c.totalActualSec,
          totalPlannedSec: c.totalPlannedSec,
          hrAvg: c.hrAvg,
        }),
      ),
  ];

  return items.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/** Число завершённых сессий ВСЕХ форматов за ISO-неделю, содержащую
 *  `weekStartIso` (понедельник "YYYY-MM-DD" в TZ юзера). Принадлежность недели
 *  считается ТЕМ ЖЕ ключом `isoWeekStartIso(startedAt, tz)`, что и группировка
 *  «Эта неделя» на /workouts — счётчик WeekCard дашборда совпадает с числом
 *  карточек текущей недели cell-for-cell (а не только силовые в серверной TZ).
 *  Вход — уже собранная `buildHistory` (completed-only), потому брошенные/
 *  отменённые в счёт не идут по построению (столп 3+4). */
export function countWeekSessions(
  history: HistoryItem[],
  weekStartIso: string,
  tz: string,
): number {
  return history.filter(
    (it) => isoWeekStartIso(it.startedAt, tz) === weekStartIso,
  ).length;
}
