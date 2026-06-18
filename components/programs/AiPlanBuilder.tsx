"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  composeAiPlanAction,
  type AiPlanActionState,
} from "@/server/actions/ai-plan";

/** Интервью ИИ-тренера: тренер задаёт ОТКРЫТЫЕ вопросы, клиент отвечает
 *  свободным текстом. Тренер читает ответы и составляет персональный план —
 *  тонко под клиента (повторы/отдых/подбор под цель, безопасные альтернативы
 *  при травмах). Payload — JSON для серверного экшена. */
export function AiPlanBuilder() {
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [schedule, setSchedule] = useState("");
  const [equipment, setEquipment] = useState("");
  const [limitations, setLimitations] = useState("");
  const [notes, setNotes] = useState("");

  const [state, formAction, pending] = useActionState<
    AiPlanActionState,
    FormData
  >(composeAiPlanAction, { status: "idle" });

  const valid = goal.trim().length >= 2;
  const payload = JSON.stringify({
    goal: goal.trim(),
    experience: experience.trim(),
    schedule: schedule.trim(),
    equipment: equipment.trim(),
    limitations: limitations.trim(),
    notes: notes.trim(),
  });

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="payload" value={payload} />

      <Question
        n={1}
        title="Какая у тебя цель?"
        hint="Чего хочешь достичь: набрать мышцы, стать сильнее, похудеть, восстановить колено, выносливость… Опиши своими словами."
        required
      >
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Например: хочу набрать мышцы и подтянуть ягодицы"
          maxLength={600}
          rows={3}
        />
      </Question>

      <Question
        n={2}
        title="Какой у тебя опыт?"
        hint="Как давно тренируешься, что уже умеешь."
      >
        <Textarea
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          placeholder="Например: год в зале, базовые упражнения знаю"
          maxLength={600}
          rows={2}
        />
      </Question>

      <Question
        n={3}
        title="Сколько раз в неделю и сколько времени готов тренироваться?"
        hint="Сколько дней в неделю и примерно сколько минут на одну тренировку."
      >
        <Textarea
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="Например: 3 раза в неделю, по часу"
          maxLength={600}
          rows={2}
        />
      </Question>

      <Question
        n={4}
        title="Где и с чем тренируешься?"
        hint="Зал, дом, какой инвентарь доступен (штанга, гантели, тренажёры, только вес тела)."
      >
        <Textarea
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="Например: полный зал / дома гантели до 20 кг"
          maxLength={600}
          rows={2}
        />
      </Question>

      <Question
        n={5}
        title="Есть травмы или ограничения?"
        hint="Например: болят колени, грыжа в пояснице, больное плечо. Тренер подберёт безопасные движения."
      >
        <Textarea
          value={limitations}
          onChange={(e) => setLimitations(e.target.value)}
          placeholder="Колени, спина, плечо… или оставь пустым"
          maxLength={600}
          rows={2}
        />
      </Question>

      <Question
        n={6}
        title="Особые пожелания?"
        hint="Например: упор на ягодицы, без становой тяги, хочу подтянуться 10 раз."
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Любые пожелания… или оставь пустым"
          maxLength={600}
          rows={2}
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
  required,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border-border rounded-2xl border p-5">
      <p className="flex items-baseline gap-2">
        <span className="text-primary text-xs font-semibold tabular-nums">
          {n}
        </span>
        <span className="text-base font-semibold tracking-tight">
          {title}
          {required ? <span className="text-destructive"> *</span> : null}
        </span>
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
