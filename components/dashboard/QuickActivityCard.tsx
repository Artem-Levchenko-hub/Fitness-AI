"use client";

import { Minus, Plus, Trash2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ExercisePicker, type PickerExercise } from "@/components/app/ExercisePicker";
import { MyoRepsResearchNote } from "@/components/templates/MyoRepsResearchNote";
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
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
  myoMiniReps,
} from "@/lib/domain/workouts/myo-reps";
import type { RecentQuickExercise } from "@/lib/repos/quick-activity.repo";
import {
  deleteQuickActivityAction,
  logQuickActivityAction,
} from "@/server/actions/quick-activity";
import { cn } from "@/lib/utils";

type QuickMode = "sets" | "total" | "myo_reps";

type TodayEntry = {
  id: string;
  exerciseName: string;
  mode: QuickMode;
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
};

type Prefill = {
  exerciseId: string;
  mode: QuickMode;
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
};

function quickEntryDetail(entry: {
  mode: QuickMode;
  reps: number;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
}) {
  if (
    entry.mode === "myo_reps" &&
    entry.myoActivationReps != null &&
    entry.myoMiniSets != null &&
    entry.myoMiniReps != null
  ) {
    return `Myo ${entry.myoActivationReps}+${entry.myoMiniSets}×${entry.myoMiniReps}`;
  }
  return `${entry.reps}${entry.mode === "total" ? " (тотал)" : ""}`;
}

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
  const [mode, setMode] = useState<QuickMode>("sets");
  const [repsText, setRepsText] = useState("10");
  const [weightText, setWeightText] = useState("");
  const [myoActivationText, setMyoActivationText] = useState("10");
  const [myoMiniSetsText, setMyoMiniSetsText] = useState(
    String(DEFAULT_MYO_MINI_SETS),
  );
  const [myoMiniRepsText, setMyoMiniRepsText] = useState(
    String(myoMiniReps(10, DEFAULT_MYO_REPS_PERCENT)),
  );
  const [myoRestText, setMyoRestText] = useState(
    String(DEFAULT_MYO_REST_SECONDS),
  );
  const [myoFirstRestText, setMyoFirstRestText] = useState("40");

  const exerciseName =
    exercises.find((e) => e.id === exerciseId)?.nameRu ?? null;

  const openWith = (prefill: Prefill | null) => {
    if (prefill) {
      setExerciseId(prefill.exerciseId);
      setMode(prefill.mode);
      setRepsText(String(prefill.reps));
      setWeightText(prefill.weightKg == null ? "" : String(prefill.weightKg));
      setMyoActivationText(
        String(prefill.myoActivationReps ?? Math.max(1, prefill.reps)),
      );
      setMyoMiniSetsText(
        String(prefill.myoMiniSets ?? DEFAULT_MYO_MINI_SETS),
      );
      setMyoMiniRepsText(
        String(
          prefill.myoMiniReps ??
            myoMiniReps(
              prefill.myoActivationReps ?? Math.max(1, prefill.reps),
              DEFAULT_MYO_REPS_PERCENT,
            ),
        ),
      );
      setMyoRestText(
        String(prefill.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS),
      );
      setMyoFirstRestText(
        String(prefill.myoFirstRestSeconds ?? 40),
      );
    } else if (!exerciseId && recent[0]) {
      setExerciseId(recent[0].exerciseId);
      setMode(recent[0].mode);
      setRepsText(String(recent[0].reps));
      setWeightText(
        recent[0].weightKg == null ? "" : String(recent[0].weightKg),
      );
      setMyoActivationText(
        String(recent[0].myoActivationReps ?? Math.max(1, recent[0].reps)),
      );
      setMyoMiniSetsText(
        String(recent[0].myoMiniSets ?? DEFAULT_MYO_MINI_SETS),
      );
      setMyoMiniRepsText(
        String(
          recent[0].myoMiniReps ??
            myoMiniReps(
              recent[0].myoActivationReps ?? Math.max(1, recent[0].reps),
              DEFAULT_MYO_REPS_PERCENT,
            ),
        ),
      );
      setMyoRestText(
        String(recent[0].myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS),
      );
      setMyoFirstRestText(
        String(recent[0].myoFirstRestSeconds ?? 40),
      );
    }
    setOpen(true);
  };

  const bumpReps = (delta: number) => {
    const cur = parseInt(repsText || "0", 10) || 0;
    setRepsText(String(Math.max(1, cur + delta)));
  };

  const bumpMyoActivation = (delta: number) => {
    const next = Math.max(1, (parseInt(myoActivationText || "0", 10) || 0) + delta);
    setMyoActivationText(String(next));
  };

  const save = (keepOpen: boolean) => {
    if (!exerciseId) {
      toast.error("Выберите упражнение");
      return;
    }

    const weightRaw =
      weightText.trim() === "" ? null : Number(weightText.replace(",", "."));
    const weightKg =
      weightRaw != null && Number.isFinite(weightRaw) ? weightRaw : null;

    if (mode === "myo_reps") {
      const myoActivationReps = parseInt(myoActivationText || "0", 10) || 0;
      const myoMiniSets = parseInt(myoMiniSetsText || "0", 10) || 0;
      const myoMiniSetReps = parseInt(myoMiniRepsText || "0", 10) || 0;
      const myoRestSeconds = parseInt(myoRestText || "0", 10) || 0;
      const myoFirstRestSeconds =
        parseInt(myoFirstRestText || "0", 10) || 0;
      if (
        myoActivationReps < 1 ||
        myoMiniSets < 1 ||
        myoMiniSetReps < 1 ||
        myoRestSeconds < 10
        || myoFirstRestSeconds < 10
      ) {
        toast.error("Проверьте параметры Myo-reps");
        return;
      }
      const reps = myoActivationReps + myoMiniSets * myoMiniSetReps;
      startTransition(async () => {
        const res = await logQuickActivityAction({
          exerciseId,
          mode,
          reps,
          weightKg,
          myoActivationReps,
          myoMiniSets,
          myoMiniReps: myoMiniSetReps,
          myoRestSeconds,
          myoFirstRestSeconds,
        });
        if (res.status === "success") {
          toast.success(
            `${exerciseName ?? "Записано"}: Myo ${myoActivationReps}+${myoMiniSets}×${myoMiniSetReps}`,
          );
          setOpen(false);
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
      return;
    }

    const reps = parseInt(repsText || "0", 10) || 0;
    if (reps < 1) {
      toast.error("Повторы ≥ 1");
      return;
    }
    startTransition(async () => {
      const res = await logQuickActivityAction({
        exerciseId,
        mode,
        reps,
        weightKg,
      });
      if (res.status === "success") {
        toast.success(
          `${exerciseName ?? "Записано"}: ${reps}${mode === "total" ? " (тотал)" : ""}`,
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
              Подход между делом — турник, эспандер, отжимания, Myo-reps
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
                  weightKg: r.weightKg,
                  myoActivationReps: r.myoActivationReps,
                  myoMiniSets: r.myoMiniSets,
                  myoMiniReps: r.myoMiniReps,
                  myoRestSeconds: r.myoRestSeconds,
                  myoFirstRestSeconds: r.myoFirstRestSeconds,
                })
              }
              className="border-border bg-background text-foreground hover:bg-accent inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium"
            >
              {r.exerciseName}
              <span className="text-muted-foreground tabular">
                ·{" "}
                {quickEntryDetail({
                  mode: r.mode,
                  reps: r.reps,
                  myoActivationReps: r.myoActivationReps,
                  myoMiniSets: r.myoMiniSets,
                  myoMiniReps: r.myoMiniReps,
                })}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <div className="mx-auto w-full max-w-md pb-[max(env(safe-area-inset-bottom),0.5rem)]">
            <SheetHeader className="px-0">
              <SheetTitle>Доп. активность</SheetTitle>
              <SheetDescription>
                Подход, тотал или Myo-reps-кластер — без создания тренировки.
                Учтётся в статистике, аватаре и недельном разборе.
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
                  title="Подход"
                  hint="одна запись"
                />
                <ModeButton
                  active={mode === "total"}
                  onClick={() => setMode("total")}
                  title="Тотал"
                  hint="всего за день"
                />
                <ModeButton
                  active={mode === "myo_reps"}
                  onClick={() => setMode("myo_reps")}
                  title="Myo-reps"
                  hint="кластер"
                />
              </div>

              {mode === "myo_reps" ? (
                <MyoRepsResearchNote
                  compact
                  summary={`${myoActivationText} активация · ${myoMiniSetsText}×${myoMiniRepsText} · отдых ${myoFirstRestText}/${myoRestText}с`}
                >
                  <div className="space-y-4">
                  <div>
                    <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                      Активационный подход
                    </p>
                    <div className="flex items-center gap-2">
                      <StepBtn onClick={() => bumpMyoActivation(-1)} label="−1" />
                      <NumberField
                        value={myoActivationText}
                        onChange={setMyoActivationText}
                        className="tabular h-14 flex-1 text-center text-2xl font-semibold"
                        aria-label="Активационные повторы"
                      />
                      <StepBtn onClick={() => bumpMyoActivation(1)} label="+1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        Мини-подходы
                      </p>
                      <NumberField
                        value={myoMiniSetsText}
                        onChange={setMyoMiniSetsText}
                        className="tabular h-11 text-center"
                        aria-label="Число мини-подходов"
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        До 1-го мини
                      </p>
                      <NumberField
                        value={myoFirstRestText}
                        onChange={setMyoFirstRestText}
                        className="tabular h-11 text-center"
                        aria-label="Отдых до первого мини-подхода"
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        Повт/мини
                      </p>
                      <NumberField
                        value={myoMiniRepsText}
                        onChange={setMyoMiniRepsText}
                        className="tabular h-11 text-center"
                        aria-label="Повторы в мини-подходе"
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                        Между мини
                      </p>
                      <NumberField
                        value={myoRestText}
                        onChange={setMyoRestText}
                        className="tabular h-11 text-center"
                        aria-label="Короткий отдых в секундах"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMyoFirstRestText("40");
                      setMyoRestText("20");
                    }}
                  >
                    Исследовательский пресет 40/20
                  </Button>
                  </div>
                </MyoRepsResearchNote>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                    {mode === "total" ? "Повторов всего" : "Повторов в подходе"}
                  </p>
                  <div className="flex items-center gap-2">
                    <StepBtn onClick={() => bumpReps(-5)} label="−5" />
                    <StepBtn
                      onClick={() => bumpReps(-1)}
                      ariaLabel="Минус один"
                      icon={<Minus className="size-5" />}
                    />
                    <NumberField
                      value={repsText}
                      onChange={setRepsText}
                      className="tabular h-14 flex-1 text-center text-2xl font-semibold"
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
              )}

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
                    className="flex-1"
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
                  className="flex-1"
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
                            {quickEntryDetail(e)}
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
        "flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 text-sm font-medium",
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
      className="border-border bg-background hover:bg-accent tabular flex size-14 shrink-0 items-center justify-center rounded-xl border text-base font-semibold"
    >
      {icon ?? label}
    </button>
  );
}
