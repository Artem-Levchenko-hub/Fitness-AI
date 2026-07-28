"use client";

import { Minus, Pencil, Plus, Trash2, Zap } from "lucide-react";
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
type StructuredMyoSet = {
  role: "activation" | "mini";
  reps: number;
  weightKg: number | null;
  restSeconds: number | null;
};
type MyoSetDraft = {
  role: "activation" | "mini";
  repsText: string;
  weightText: string;
  restText: string;
};

type TodayEntry = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  mode: QuickMode;
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
  myoSets: StructuredMyoSet[] | null;
};

type Prefill = {
  id?: string;
  exerciseId: string;
  mode: QuickMode;
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
  myoSets: StructuredMyoSet[] | null;
};

function quickEntryDetail(entry: {
  mode: QuickMode;
  reps: number;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoSets?: StructuredMyoSet[] | null;
}) {
  if (entry.mode === "myo_reps" && entry.myoSets?.length) {
    return `Myo ${entry.myoSets.map((set) => set.reps).join("+")}`;
  }
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<QuickMode>("sets");
  const [repsText, setRepsText] = useState("10");
  const [weightText, setWeightText] = useState("");
  const [myoSets, setMyoSets] = useState<MyoSetDraft[]>(() =>
    defaultStructuredMyoSets(),
  );

  const exerciseName =
    exercises.find((e) => e.id === exerciseId)?.nameRu ?? null;

  const openWith = (prefill: Prefill | null) => {
    setEditingId(prefill?.id ?? null);
    if (prefill) {
      setExerciseId(prefill.exerciseId);
      setMode(prefill.mode);
      setRepsText(String(prefill.reps));
      setWeightText(prefill.weightKg == null ? "" : String(prefill.weightKg));
      setMyoSets(
        prefill.myoSets?.length
          ? persistedToDraft(prefill.myoSets)
          : structuredFromLegacy(prefill),
      );
    } else if (!exerciseId && recent[0]) {
      setExerciseId(recent[0].exerciseId);
      setMode(recent[0].mode);
      setRepsText(String(recent[0].reps));
      setWeightText(
        recent[0].weightKg == null ? "" : String(recent[0].weightKg),
      );
      setMyoSets(
        recent[0].myoSets?.length
          ? persistedToDraft(recent[0].myoSets)
          : structuredFromLegacy(recent[0]),
      );
    } else if (!prefill) {
      setMyoSets(defaultStructuredMyoSets());
    }
    setOpen(true);
  };

  const bumpReps = (delta: number) => {
    const cur = parseInt(repsText || "0", 10) || 0;
    setRepsText(String(Math.max(1, cur + delta)));
  };

  const updateMyoSet = (index: number, patch: Partial<MyoSetDraft>) => {
    setMyoSets((current) =>
      current.map((set, setIndex) =>
        setIndex === index ? { ...set, ...patch } : set,
      ),
    );
  };

  const addMyoMiniSet = () => {
    setMyoSets((current) =>
      current.length >= 11
        ? current
        : [
            ...current,
            {
              role: "mini",
              repsText: current.at(-1)?.repsText || "3",
              weightText: current.at(-1)?.weightText || "",
              restText: current.at(-1)?.restText || String(DEFAULT_MYO_REST_SECONDS),
            },
          ],
    );
  };

  const removeMyoMiniSet = (index: number) => {
    setMyoSets((current) =>
      current.length <= 2 ? current : current.filter((_, i) => i !== index),
    );
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
      const structured = myoSets.map(normalizeMyoSet);
      const activation = structured[0];
      const minis = structured.slice(1);
      if (
        !activation ||
        activation.role !== "activation" ||
        minis.length < 1 ||
        structured.some(
          (set) =>
            set.reps < 1 ||
            set.reps > 100 ||
            (set.weightKg != null && (set.weightKg < 0 || set.weightKg > 500)) ||
            (set.restSeconds != null &&
              (set.restSeconds < 0 || set.restSeconds > 300)),
        )
      ) {
        toast.error("Проверьте повторы, вес и отдых в каждом Myo-подходе");
        return;
      }
      const reps = structured.reduce((sum, set) => sum + set.reps, 0);
      const myoMiniSets = minis.length;
      const myoMiniSetReps = minis[0]?.reps ?? 1;
      const myoRestSeconds =
        minis[0]?.restSeconds ?? DEFAULT_MYO_REST_SECONDS;
      const myoFirstRestSeconds = activation.restSeconds ?? 40;
      startTransition(async () => {
        const res = await logQuickActivityAction({
          id: editingId ?? undefined,
          exerciseId,
          mode,
          reps,
          weightKg: activation.weightKg,
          myoActivationReps: activation.reps,
          myoMiniSets,
          myoMiniReps: myoMiniSetReps,
          myoRestSeconds,
          myoFirstRestSeconds,
          myoSets: structured,
        });
        if (res.status === "success") {
          toast.success(
            `${exerciseName ?? "Записано"}: Myo ${structured
              .map((set) => set.reps)
              .join("+")}`,
          );
          setEditingId(null);
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
        id: editingId ?? undefined,
        exerciseId,
        mode,
        reps,
        weightKg,
        myoActivationReps: null,
        myoMiniSets: null,
        myoMiniReps: null,
        myoRestSeconds: null,
        myoFirstRestSeconds: null,
        myoSets: null,
      });
      if (res.status === "success") {
        toast.success(
          `${exerciseName ?? "Записано"}: ${reps}${mode === "total" ? " (тотал)" : ""}`,
        );
        if (!keepOpen || editingId) {
          setEditingId(null);
          setOpen(false);
        }
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
                   myoSets: r.myoSets,
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
                   myoSets: r.myoSets,
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
              <SheetTitle>
                {editingId ? "Изменить активность" : "Доп. активность"}
              </SheetTitle>
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
                   summary={myoDraftSummary(myoSets)}
                 >
                   <div className="space-y-3">
                     <div className="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem_3rem] gap-2 px-1">
                       <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                         Подход / повторы
                       </span>
                       <span className="text-muted-foreground text-center text-[10px] font-medium tracking-wide uppercase">
                         Вес
                       </span>
                       <span className="text-muted-foreground text-center text-[10px] font-medium tracking-wide uppercase">
                         Отдых
                       </span>
                       <span className="sr-only">Действия</span>
                     </div>
                     {myoSets.map((set, index) => (
                       <div
                         key={`${set.role}-${index}`}
                         className="border-border bg-background grid grid-cols-[minmax(0,1fr)_4rem_4.5rem_3rem] items-end gap-2 rounded-xl border p-2"
                       >
                         <label className="min-w-0">
                           <span className="text-muted-foreground block truncate text-[10px] font-medium">
                             {set.role === "activation"
                               ? "Активация"
                               : `Мини ${index}`}
                           </span>
                           <NumberField
                             value={set.repsText}
                             onChange={(value) =>
                               updateMyoSet(index, { repsText: value })
                             }
                             className="tabular mt-1 h-10 text-center font-semibold"
                             aria-label={`${set.role === "activation" ? "Активация" : `Мини-подход ${index}`}: повторы`}
                           />
                         </label>
                         <label>
                           <span className="sr-only">
                             {set.role === "activation"
                               ? "Активация"
                               : `Мини-подход ${index}`}
                             : вес, кг
                           </span>
                           <NumberField
                             decimal
                             value={set.weightText}
                             onChange={(value) =>
                               updateMyoSet(index, { weightText: value })
                             }
                             placeholder="—"
                             className="tabular h-10 text-center"
                             aria-label={`${set.role === "activation" ? "Активация" : `Мини-подход ${index}`}: вес в килограммах`}
                           />
                         </label>
                         <label>
                           <span className="sr-only">
                             {set.role === "activation"
                               ? "Активация"
                               : `Мини-подход ${index}`}
                             : отдых, секунд
                           </span>
                           <NumberField
                             value={set.restText}
                             onChange={(value) =>
                               updateMyoSet(index, { restText: value })
                             }
                             placeholder="—"
                             className="tabular h-10 text-center"
                             aria-label={`${set.role === "activation" ? "Активация" : `Мини-подход ${index}`}: отдых в секундах`}
                           />
                         </label>
                         {set.role === "mini" ? (
                           <button
                             type="button"
                             onClick={() => removeMyoMiniSet(index)}
                             disabled={myoSets.length <= 2}
                             aria-label={`Удалить мини-подход ${index}`}
                             className="text-muted-foreground hover:text-destructive disabled:opacity-30 flex size-10 items-center justify-center rounded-md"
                           >
                             <Trash2 className="size-4" />
                           </button>
                         ) : (
                           <span aria-hidden className="size-10" />
                         )}
                       </div>
                     ))}
                     <div className="flex flex-wrap gap-2">
                       <Button
                         type="button"
                         size="sm"
                         variant="outline"
                         onClick={addMyoMiniSet}
                         disabled={myoSets.length >= 11}
                       >
                         <Plus className="size-4" />
                         Мини-подход
                       </Button>
                       <Button
                         type="button"
                         size="sm"
                         variant="outline"
                         onClick={() =>
                           setMyoSets((current) =>
                             current.map((set) => ({
                               ...set,
                               restText:
                                 set.role === "activation"
                                   ? "40"
                                   : String(DEFAULT_MYO_REST_SECONDS),
                             })),
                           )
                         }
                       >
                         Пресет отдыха 40/20
                       </Button>
                     </div>
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

              {mode !== "myo_reps" ? (
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
              ) : null}

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
                  {editingId ? "Сохранить изменения" : "Сохранить"}
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
                        <span className="flex shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openWith({
                                id: e.id,
                                exerciseId: e.exerciseId,
                                mode: e.mode,
                                reps: e.reps,
                                weightKg: e.weightKg,
                                myoActivationReps: e.myoActivationReps,
                                myoMiniSets: e.myoMiniSets,
                                myoMiniReps: e.myoMiniReps,
                                myoRestSeconds: e.myoRestSeconds,
                                myoFirstRestSeconds:
                                  e.myoFirstRestSeconds,
                                myoSets: e.myoSets,
                              })
                            }
                            disabled={pending}
                            aria-label="Изменить запись"
                            className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-md"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(e.id)}
                            disabled={pending}
                            aria-label="Удалить запись"
                            className="text-muted-foreground hover:text-destructive flex size-9 items-center justify-center rounded-md"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </span>
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

function defaultStructuredMyoSets(): MyoSetDraft[] {
  const activationReps = 10;
  const miniReps = myoMiniReps(activationReps, DEFAULT_MYO_REPS_PERCENT);
  return [
    {
      role: "activation",
      repsText: String(activationReps),
      weightText: "",
      restText: "40",
    },
    ...Array.from({ length: DEFAULT_MYO_MINI_SETS }, () => ({
      role: "mini" as const,
      repsText: String(miniReps),
      weightText: "",
      restText: String(DEFAULT_MYO_REST_SECONDS),
    })),
  ];
}

function persistedToDraft(sets: StructuredMyoSet[]): MyoSetDraft[] {
  return sets.map((set) => ({
    role: set.role,
    repsText: String(set.reps),
    weightText: set.weightKg == null ? "" : String(set.weightKg),
    restText: set.restSeconds == null ? "" : String(set.restSeconds),
  }));
}

function structuredFromLegacy(entry: {
  reps: number;
  weightKg: number | null;
  myoActivationReps: number | null;
  myoMiniSets: number | null;
  myoMiniReps: number | null;
  myoRestSeconds: number | null;
  myoFirstRestSeconds: number | null;
}): MyoSetDraft[] {
  const activationReps = entry.myoActivationReps ?? Math.max(1, entry.reps);
  const miniCount = entry.myoMiniSets ?? DEFAULT_MYO_MINI_SETS;
  const miniReps =
    entry.myoMiniReps ??
    myoMiniReps(activationReps, DEFAULT_MYO_REPS_PERCENT);
  const weightText = entry.weightKg == null ? "" : String(entry.weightKg);
  return [
    {
      role: "activation",
      repsText: String(activationReps),
      weightText,
      restText: String(entry.myoFirstRestSeconds ?? 40),
    },
    ...Array.from({ length: miniCount }, () => ({
      role: "mini" as const,
      repsText: String(miniReps),
      weightText,
      restText: String(entry.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS),
    })),
  ];
}

function normalizeMyoSet(set: MyoSetDraft): StructuredMyoSet {
  const weight =
    set.weightText.trim() === ""
      ? null
      : Number(set.weightText.replace(",", "."));
  const rest =
    set.restText.trim() === "" ? null : Number.parseInt(set.restText, 10);
  return {
    role: set.role,
    reps: Number.parseInt(set.repsText, 10) || 0,
    weightKg: weight != null && Number.isFinite(weight) ? weight : -1,
    restSeconds: rest != null && Number.isFinite(rest) ? rest : -1,
  };
}

function myoDraftSummary(sets: MyoSetDraft[]) {
  const reps = sets.map((set) => set.repsText || "—").join("+");
  const activationRest = sets[0]?.restText || "—";
  const miniRest = sets[1]?.restText || "—";
  return `${reps} повторов · паузы ${activationRest}/${miniRest}с`;
}
