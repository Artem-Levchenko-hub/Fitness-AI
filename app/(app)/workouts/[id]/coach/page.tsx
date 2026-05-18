import { CheckCircle2, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isAiConfigured } from "@/lib/ai/deepseek";
import { requireUser } from "@/lib/auth/require-user";
import { totalVolume } from "@/lib/domain";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";

import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "AI-коуч" };

type Props = { params: Promise<{ id: string }> };

export default async function CoachPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const workout = await getActiveWorkoutForUser(user.id, id);
  if (!workout) notFound();

  // Если тренировка ещё не завершена — отправляем на active workout view
  if (workout.status === "active") {
    redirect(`/workouts/${id}`);
  }

  const totalSets = workout.exercises.reduce(
    (sum, e) => sum + e.sets.length,
    0,
  );
  const tonnageKg = workout.exercises.reduce(
    (sum, e) =>
      sum +
      totalVolume(
        e.sets.map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          setType: s.setType,
        })),
      ),
    0,
  );
  const durationMin = workout.finishedAt
    ? Math.round(
        (workout.finishedAt.getTime() - workout.startedAt.getTime()) / 60_000,
      )
    : null;

  const aiOn = isAiConfigured();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          После тренировки
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          {workout.name}
        </h1>
      </header>

      <section className="bg-success/5 border-success/20 mb-6 rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <div className="bg-success/15 text-success mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              Тренировка завершена
            </h2>
            <ul className="text-muted-foreground tabular mt-2 grid grid-cols-3 gap-2 text-xs">
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {totalSets}
                </p>
                <p>подходов</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {Math.round(tonnageKg).toLocaleString("ru")}
                </p>
                <p>kg·reps</p>
              </li>
              <li>
                <p className="text-foreground tabular text-2xl font-semibold">
                  {durationMin ?? "—"}
                </p>
                <p>минут</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-serif mb-3 text-2xl font-normal tracking-tight">
          Поговорить с коучем
        </h2>
        {aiOn ? (
          <CoachChat workoutId={workout.id} workoutName={workout.name} />
        ) : (
          <AiOffNotice />
        )}
      </section>

      <p className="text-muted-foreground/70 px-1 text-xs">
        Коуч сохранит итог разговора в заметки тренировки. Дальше анализ будет
        учитывать эту запись как «вторую память».
      </p>
    </main>
  );
}

function AiOffNotice() {
  return (
    <div className="bg-card border-border space-y-3 rounded-2xl border p-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        AI-коуч пока выключен. Чтобы он заработал, владельцу проекта нужно
        добавить ключ <code className="bg-muted rounded px-1 py-0.5">AI_API_KEY</code>{" "}
        в <code className="bg-muted rounded px-1 py-0.5">.env.production</code> и
        перезапустить процесс.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">На главную</Link>
      </Button>
    </div>
  );
}
