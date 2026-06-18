"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DAYS_PER_WEEK_OPTIONS,
  EQUIPMENT_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  PLAN_GOALS,
  SESSION_MINUTES_OPTIONS,
  type PlanEquipment,
  type PlanExperience,
  type PlanGoal,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  composeAiPlanAction,
  type AiPlanActionState,
} from "@/server/actions/ai-plan";

const EXPERIENCES: PlanExperience[] = ["beginner", "intermediate", "advanced"];
const EQUIPMENTS: PlanEquipment[] = [
  "full_gym",
  "free_weights",
  "dumbbells_only",
  "bodyweight",
];

/** Интервью ИИ-тренера: тренер задаёт вопросы (цель, опыт, частота, время,
 *  инвентарь, травмы), затем составляет персональный план. В отличие от готовых
 *  пресетов — тонко под клиента (повторы/отдых/подбор под цель, безопасные
 *  альтернативы при травмах). Payload — JSON для серверного экшена. */
export function AiPlanBuilder() {
  const [goals, setGoals] = useState<PlanGoal[]>([]);
  const [experience, setExperience] = useState<PlanExperience>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [equipment, setEquipment] = useState<PlanEquipment>("full_gym");
  const [limitations, setLimitations] = useState("");
  const [notes, setNotes] = useState("");

  const [state, formAction, pending] = useActionState<
    AiPlanActionState,
    FormData
  >(composeAiPlanAction, { status: "idle" });

  function toggleGoal(g: PlanGoal) {
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  const valid = goals.length >= 1;
  const payload = JSON.stringify({
    goals,
    experience,
    daysPerWeek,
    sessionMinutes,
    equipment,
    limitations: limitations.trim(),
    notes: notes.trim(),
  });

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="payload" value={payload} />

      <Question
        n={1}
        title="Какая у тебя цель?"
        hint="Можно выбрать несколько — тренер совместит их в плане."
      >
        <div className="flex flex-wrap gap-2">
          {PLAN_GOALS.map((g) => (
            <Chip key={g} on={goals.includes(g)} onClick={() => toggleGoal(g)}>
              {GOAL_LABELS[g]}
            </Chip>
          ))}
        </div>
      </Question>

      <Question n={2} title="Какой у тебя опыт?">
        <div className="flex flex-wrap gap-2">
          {EXPERIENCES.map((e) => (
            <Chip key={e} on={experience === e} onClick={() => setExperience(e)}>
              {EXPERIENCE_LABELS[e]}
            </Chip>
          ))}
        </div>
      </Question>

      <Question n={3} title="Сколько дней в неделю готов тренироваться?">
        <div className="flex flex-wrap gap-2">
          {DAYS_PER_WEEK_OPTIONS.map((d) => (
            <Chip key={d} on={daysPerWeek === d} onClick={() => setDaysPerWeek(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </Question>

      <Question n={4} title="Сколько времени на одну тренировку?">
        <div className="flex flex-wrap gap-2">
          {SESSION_MINUTES_OPTIONS.map((m) => (
            <Chip
              key={m}
              on={sessionMinutes === m}
              onClick={() => setSessionMinutes(m)}
            >
              {m} мин
            </Chip>
          ))}
        </div>
      </Question>

      <Question n={5} title="Какой инвентарь доступен?">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENTS.map((eq) => (
            <Chip key={eq} on={equipment === eq} onClick={() => setEquipment(eq)}>
              {EQUIPMENT_LABELS[eq]}
            </Chip>
          ))}
        </div>
      </Question>

      <Question
        n={6}
        title="Есть травмы или ограничения?"
        hint="Например: болят колени, грыжа в пояснице, больное плечо. Тренер подберёт безопасные движения."
      >
        <Textarea
          value={limitations}
          onChange={(e) => setLimitations(e.target.value)}
          placeholder="Колени, спина, плечо… или оставь пустым"
          maxLength={500}
          rows={3}
        />
      </Question>

      <Question
        n={7}
        title="Особые пожелания?"
        hint="Например: упор на ягодицы, без становой тяги, хочу подтянуться 10 раз."
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Любые пожелания… или оставь пустым"
          maxLength={500}
          rows={3}
        />
      </Question>

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
        <Sparkles className="size-5" />
        {pending ? "Тренер составляет план…" : "Составить план"}
      </Button>
      {pending ? (
        <p className="text-muted-foreground text-center text-xs">
          Это занимает до минуты — тренер подбирает упражнения под тебя.
        </p>
      ) : null}
    </form>
  );
}

function Question({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border-border rounded-2xl border p-5">
      <p className="flex items-baseline gap-2">
        <span className="text-primary text-xs font-semibold tabular-nums">
          {n}
        </span>
        <span className="text-base font-semibold tracking-tight">{title}</span>
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">
          {hint}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
