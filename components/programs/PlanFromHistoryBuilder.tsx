"use client";

import { Check, History } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createPlanFromWorkoutsAction,
  type ProgramActionState,
} from "@/server/actions/training-programs";

export type HistoryWorkoutOption = {
  id: string;
  name: string;
  dateLabel: string;
  setCount: number;
};

/** Сборка плана ПРЯМО ИЗ ИСТОРИИ: имя + выбор завершённых тренировок в нужном
 *  порядке (порядок выбора = порядок дней). Для атлета, который тренируется по
 *  факту без шаблонов — превращает сделанное в повторяемую программу. Payload —
 *  JSON для серверного экшена (зеркало ProgramWrapBuilder). */
export function PlanFromHistoryBuilder({
  workouts,
}: {
  workouts: HistoryWorkoutOption[];
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<
    ProgramActionState,
    FormData
  >(createPlanFromWorkoutsAction, { status: "idle" });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const valid = name.trim().length >= 2 && selected.length >= 1;
  const payload = JSON.stringify({ name: name.trim(), workoutIds: selected });

  if (workouts.length === 0) {
    return (
      <div className="bg-muted text-muted-foreground rounded-xl p-4 text-sm">
        Пока нет завершённых силовых тренировок. Проведи хотя бы одну — и сможешь
        собрать из неё план.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <div className="space-y-2">
        <label htmlFor="plan-name" className="text-sm font-medium">
          Название плана
        </label>
        <Input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Мой сплит из истории"
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Тренировки-дни</p>
        <p className="text-muted-foreground text-xs">
          Выбери свои прошлые тренировки по порядку — каждая станет днём плана
          ровно с теми упражнениями, весами и повторами, что ты делал.
        </p>
        <ul className="space-y-2">
          {workouts.map((w) => {
            const order = selected.indexOf(w.id);
            const isOn = order !== -1;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => toggle(w.id)}
                  aria-pressed={isOn}
                  className={cn(
                    "border-border flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                    isOn ? "border-primary bg-primary/5" : "bg-card hover:bg-accent",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {w.name}
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {w.dateLabel} · {w.setCount} подх.
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      isOn
                        ? "bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground border",
                    )}
                  >
                    {isOn ? order + 1 : <Check className="size-3 opacity-0" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {state.status === "error" ? (
        <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={!valid || pending}
      >
        <History className="size-4" />
        {pending ? "Собираем…" : "Собрать план из истории"}
      </Button>
    </form>
  );
}
