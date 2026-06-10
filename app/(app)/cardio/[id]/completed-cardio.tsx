import { CheckCircle2, Heart } from "lucide-react";

import type { CardioBlock, CardioWorkout } from "@/db/schema";
import { avgWorkHr } from "@/lib/domain";

export function CompletedCardio({
  workout,
  blocks,
}: {
  workout: CardioWorkout;
  blocks: CardioBlock[];
}) {
  const workBlocks = blocks.filter((b) => b.kind === "work");
  const completedWork = workBlocks.filter((b) => b.completedAt != null);
  const totalActualSec = blocks.reduce(
    (s, b) => s + (b.actualDurationSec ?? 0),
    0,
  );
  const totalPlannedSec = blocks.reduce(
    (s, b) => s + b.plannedDurationSec,
    0,
  );
  const hr = avgWorkHr(blocks);
  const durationMin = workout.finishedAt
    ? Math.max(
        1,
        Math.round(
          (workout.finishedAt.getTime() - workout.startedAt.getTime()) /
            60_000,
        ),
      )
    : Math.round(totalActualSec / 60);
  const isCancelled = workout.status === "cancelled";

  return (
    <div className="space-y-5">
      <section
        className={
          isCancelled
            ? "bg-warning/5 border-warning/30 rounded-2xl border p-5"
            : "bg-success/5 border-success/20 rounded-2xl border p-5"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isCancelled
                ? "bg-warning/15 text-warning mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
                : "bg-success/15 text-success mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
            }
          >
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              {isCancelled ? "Сессия прервана" : "Сессия завершена"}
            </h2>
            <ul className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-2 text-xs">
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {completedWork.length}
                </p>
                <p>из {workBlocks.length} раундов</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {durationMin}
                </p>
                <p>минут</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {hr != null ? hr : "—"}
                </p>
                <p>HR ср.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-card border-border rounded-2xl border p-4">
        <h3 className="mb-3 text-sm font-semibold tracking-tight">Блоки</h3>
        <ul className="tabular space-y-1.5 text-sm">
          {blocks.map((b, i) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 text-foreground"
            >
              <span className="text-muted-foreground inline-flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-medium">
                {i + 1}
              </span>
              <span className="flex-1">
                {b.label}{" "}
                <span className="text-muted-foreground text-xs">
                  · план {b.plannedDurationSec}с
                </span>
              </span>
              {b.kind === "work" ? (
                <span className="text-muted-foreground tabular flex items-center gap-3 text-xs">
                  {b.hrAvg != null ? (
                    <span className="text-foreground flex items-center gap-1">
                      <Heart className="size-3" />
                      {b.hrAvg}
                    </span>
                  ) : null}
                  {b.rpe != null ? <span>RPE {b.rpe}</span> : null}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">отдых</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {workout.notes ? (
        <section className="bg-card border-border rounded-2xl border p-4 text-sm">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Заметка
          </p>
          <p className="mt-1 whitespace-pre-wrap">{workout.notes}</p>
        </section>
      ) : null}

      {totalActualSec > 0 && totalActualSec < totalPlannedSec ? (
        <p className="text-muted-foreground/70 px-1 text-xs">
          Сделано {totalActualSec}с из плановых {totalPlannedSec}с.
        </p>
      ) : null}
    </div>
  );
}
