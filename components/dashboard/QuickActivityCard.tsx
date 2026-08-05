"use client";

import { Minus, Plus, Trash2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ExercisePicker, type PickerExercise } from "@/components/app/ExercisePicker";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { QuickDaySummary } from "@/lib/domain/quick-activity/summary";
import type { RecentQuickExercise } from "@/lib/repos/quick-activity.repo";
import {
  deleteQuickActivityAction,
  logQuickActivityAction,
} from "@/server/actions/quick-activity";
import { cn } from "@/lib/utils";

type TodayEntry = {
  id: string;
  exerciseName: string;
  mode: "sets" | "myo_reps" | "total";
  reps: number;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  weightKg: number | null;
};

type Prefill = {
  exerciseId: string;
  mode: "sets" | "myo_reps" | "total";
  reps: number;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  weightKg: number | null;
};

/** Карточка «Доп. активность»: сводка сегодня + чипы-повторы + bottom-sheet
 *  быстрой записи. Цель — 2 тапа на повтор привычного (чип → «Сохранить»).
 *  Критичные тапы ≥56px (h-14, R-41). */
export function QuickActivityCard({
  summary,
  todayEntries,
  recent,
  exercises,
}: {
  summary: QuickDaySummary[];
  todayEntries: TodayEntry[];
  recent: RecentQuickExercise[];
  exercises: PickerExercise[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [mode, setMode] = useState<"sets" | "myo_reps" | "total">("sets");
  const [repsText, setRepsText] = useState("10");
  const [myoMiniSetsText, setMyoMiniSetsText] = useState("3");
  const [myoMiniRepsText, setMyoMiniRepsText] = useState("5");
  const [weightText, setWeightText] = useState("");

  const exerciseName =
    exercises.find((e) => e.id === exerciseId)?.nameRu ?? null;

  const openWith = (prefill: Prefill | null) => {
    if (prefill) {
      setExerciseId(prefill.exerciseId);
      setMode(prefill.mode);
      setRepsText(String(prefill.reps));
      setMyoMiniSetsText(String(prefill.myoMiniSets ?? 3));
      setMyoMiniRepsText(String(prefill.myoMiniReps ?? 5));
      setWeightText(prefill.weightKg == null ? "" : String(prefill.weightKg));
    } else if (!exerciseId && recent[0]) {
      // Пустой старт: префилл последним использованным упражнением — режим и
      // повторы оно «помнит» само (эспандер → тотал 100, турник → подход 10).
      setExerciseId(recent[0].exerciseId);
      setMode(recent[0].mode);
      setRepsText(String(recent[0].reps));
      setMyoMiniSetsText(String(recent[0].myoMiniSets ?? 3));
      setMyoMiniRepsText(String(recent[0].myoMiniReps ?? 5));
      setWeightText(
        recent[0].weightKg == null ? "" : String(recent[0].weightKg),
      );
    }
    setOpen(true);
  };

  const bumpReps = (delta: number) => {
    const cur = parseInt(repsText || "0", 10) || 0;
    setRepsText(String(Math.max(1, cur + delta)));
  };

  const save = (keepOpen: boolean) => {
    const reps = parseInt(repsText || "0", 10) || 0;
    const myoMiniSets = Math.min(
      10,
      Math.max(1, parseInt(myoMiniSetsText || "3", 10) || 3),
    );
    const myoMiniReps = Math.min(
      30,
      Math.max(1, parseInt(myoMiniRepsText || "5", 10) || 5),
    );
    if (!exerciseId) {
      toast.error("Выберите упражнение");
      return;
    }
    if (reps < 1) {
      toast.error("Повторы ≥ 1");
      return;
    }
    const weightRaw =
      weightText.trim() === "" ? null : Number(weightText.replace(",", "."));
    startTransition(async () => {
      const res = await logQuickActivityAction({
        exerciseId,
        mode,
        reps,
        myoMiniSets,
        myoMiniReps,
        weightKg: weightRaw != null && Number.isFinite(weightRaw) ? weightRaw : null,
      });
      if (res.status === "success") {
        toast.success(
          `${exerciseName ?? "Записано"}: ${formatQuickEntry({
            mode,
            reps,
            myoMiniSets,
            myoMiniReps,
          })}`,
        );
        if (!keepOpen) setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteQuickActivityAction(id);
      if (res.status === "success") router.refresh();
      else toast.error(res.message);
    });
  };

  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <Zap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
            Доп. активность
          </p>
          {summary.length > 0 ? (
            <p className="text-foreground mt-0.5 truncate text-sm font-medium">
              {summary.map((g) => `${g.exerciseName} ${g.detail}`).join(" · ")}
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-sm">
              Подход между делом — турник, эспандер, отжимания
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openWith(null)}
          data-testid="quick-activity-open"
        >
          <Plus className="size-4" />
          Записать
        </Button>
      </div>

      {recent.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {recent.map((r) => (
            <button
              key={r.exerciseId}
              type="button"
              onClick={() =>
                openWith({
                  exerciseId: r.exerciseId,
                  mode: r.mode,
                  reps: r.reps,
                  myoMiniSets: r.myoMiniSets,
                  myoMiniReps: r.myoMiniReps,
                  weightKg: r.weightKg,
                })
              }
              className="border-border bg-background text-foreground hover:bg-accent inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium"
              >
              {r.exerciseName}
              <span className="text-muted-foreground tabular">
                · {formatQuickEntry(r)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] w-full max-w-full overflow-x-clip overflow-y-auto rounded-t-2xl px-4 pt-4"
          data-testid="quick-activity-sheet"
        >
          <div className="mx-auto min-w-0 w-full max-w-md pb-[max(env(safe-area-inset-bottom),0.5rem)]">
            <SheetHeader className="px-0">
              <SheetTitle>Доп. активность</SheetTitle>
              <SheetDescription>
                Подход или тотал за день — без создания тренировки. Учтётся в
                статистике, аватаре и недельном разборе.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-3 space-y-4">
              <ExercisePicker
                exercises={exercises}
                value={exerciseId}
                onChange={(id) => setExerciseId(id)}
              />

              <div className="grid grid-cols-3 gap-2">
                <ModeButton
                  active={mode === "sets"}
                  onClick={() => setMode("sets")}
                  title="Подходами"
                  hint="подход = запись"
                />
                <ModeButton
                  active={mode === "myo_reps"}
                  onClick={() => setMode("myo_reps")}
                  title="Myo-reps"
                  hint="кластер = 4 подхода"
                />
                <ModeButton
                  active={mode === "total"}
                  onClick={() => setMode("total")}
                  title="Тотал"
                  hint="всего за день"
                />
              </div>

              <div>
                <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                  {mode === "total"
                    ? "Повторов всего"
                    : mode === "myo_reps"
                      ? "Активация, повторов"
                      : "Повторов в подходе"}
                </p>
                <div className="grid grid-cols-[3rem_3rem_minmax(4rem,1fr)_3rem_3rem] items-center gap-2 sm:grid-cols-[3.5rem_3.5rem_minmax(5rem,1fr)_3.5rem_3.5rem]">
                  <StepBtn onClick={() => bumpReps(-5)} label="−5" />
                  <StepBtn
                    onClick={() => bumpReps(-1)}
                    ariaLabel="Минус один"
                    icon={<Minus className="size-5" />}
                  />
                  <NumberField
                    value={repsText}
                    onChange={setRepsText}
                    className="tabular h-12 min-w-0 text-center text-2xl font-semibold sm:h-14"
                    aria-label="Повторы"
                    data-testid="quick-activity-reps"
                  />
                  <StepBtn
                    onClick={() => bumpReps(1)}
                    ariaLabel="Плюс один"
                    icon={<Plus className="size-5" />}
                  />
                  <StepBtn onClick={() => bumpReps(5)} label="+5" />
                </div>
              </div>

              {mode === "myo_reps" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Мини-сетов
                    <NumberField
                      value={myoMiniSetsText}
                      onChange={setMyoMiniSetsText}
                      className="text-foreground tabular mt-1 h-11 text-sm normal-case tracking-normal"
                      aria-label="Мини-сеты"
                      placeholder="3"
                    />
                  </label>
                  <label className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                    Повторов в мини
                    <NumberField
                      value={myoMiniRepsText}
                      onChange={setMyoMiniRepsText}
                      className="text-foreground tabular mt-1 h-11 text-sm normal-case tracking-normal"
                      aria-label="Повторы в мини-сете"
                      placeholder="5"
                    />
                  </label>
                  <p className="text-muted-foreground col-span-2 text-xs">
                    Мини-сеты: {myoMiniSetsText || 3} × {myoMiniRepsText || 5}.
                    Всего это считается как рабочие подходы.
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                  Доп. вес, кг (необязательно)
                </p>
                <NumberField
                  value={weightText}
                  onChange={setWeightText}
                  decimal
                  placeholder="без веса"
                  className="tabular h-11"
                />
              </div>

              <div className="flex gap-2">
                {mode === "sets" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xl"
                    className="min-w-0 flex-1 px-3 sm:px-6"
                    disabled={pending}
                    onClick={() => save(true)}
                    data-testid="quick-activity-save-more"
                  >
                    + Ещё подход
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="xl"
                  className="min-w-0 flex-1 px-3 sm:px-6"
                  disabled={pending}
                  onClick={() => save(false)}
                  data-testid="quick-activity-save"
                >
                  Сохранить
                </Button>
              </div>

              {todayEntries.length > 0 ? (
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                    Сегодня
                  </p>
                  <ul className="space-y-1">
                    {todayEntries.map((e) => (
                      <li
                        key={e.id}
                        className="border-border flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5"
                      >
                        <span className="min-w-0 truncate text-sm">
                          {e.exerciseName}
                          <span className="text-muted-foreground tabular ml-1.5">
                            {formatQuickEntry(e)}
                            {e.weightKg != null ? ` · +${e.weightKg} кг` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(e.id)}
                          disabled={pending}
                          aria-label="Удалить запись"
                          className="text-muted-foreground hover:text-destructive flex size-9 shrink-0 items-center justify-center rounded-md"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatQuickEntry(entry: {
  mode: "sets" | "myo_reps" | "total";
  reps: number;
  myoMiniSets?: number | null;
  myoMiniReps?: number | null;
}): string {
  if (entry.mode === "total") return `${entry.reps} (тотал)`;
  if (entry.mode === "myo_reps") {
    return `${entry.reps}+${entry.myoMiniSets ?? 3}×${entry.myoMiniReps ?? 5}`;
  }
  return String(entry.reps);
}

function ModeButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center rounded-xl border px-1 text-xs font-medium",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground",
      )}
    >
      {title}
      <span className="text-muted-foreground text-[10px] font-normal">
        {hint}
      </span>
    </button>
  );
}

function StepBtn({
  onClick,
  label,
  icon,
  ariaLabel,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="border-border bg-background hover:bg-accent tabular flex size-12 shrink-0 items-center justify-center rounded-xl border text-base font-semibold sm:size-14"
    >
      {icon ?? label}
    </button>
  );
}
