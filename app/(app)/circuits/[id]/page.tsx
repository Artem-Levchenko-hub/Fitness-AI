import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { getCircuitForUser } from "@/lib/repos/circuits.repo";

import { ActiveCircuit } from "./active-circuit";
import { CompletedCircuit } from "./completed-circuit";

export const metadata: Metadata = { title: "Круговая" };

type Props = { params: Promise<{ id: string }> };

export default async function CircuitPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const c = await getCircuitForUser(user.id, id);
  if (!c) notFound();

  // AI analysis по этому circuit (если уже посчитан)
  const [analysis] = await db
    .select({
      id: schema.aiAnalyses.id,
      content: schema.aiAnalyses.content,
      resultJson: schema.aiAnalyses.resultJson,
      createdAt: schema.aiAnalyses.createdAt,
    })
    .from(schema.aiAnalyses)
    .where(
      and(
        eq(schema.aiAnalyses.userId, user.id),
        eq(schema.aiAnalyses.circuitWorkoutId, id),
      ),
    )
    .orderBy(desc(schema.aiAnalyses.createdAt))
    .limit(1);

  // Статус AI-задачи (для индикации pending)
  const [job] = await db
    .select({
      id: schema.aiJobs.id,
      status: schema.aiJobs.status,
      lastError: schema.aiJobs.lastError,
    })
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.userId, user.id),
        eq(schema.aiJobs.circuitWorkoutId, id),
        eq(schema.aiJobs.kind, "circuit_post_workout"),
      ),
    )
    .orderBy(desc(schema.aiJobs.scheduledAt))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/workouts">
          <ChevronLeft className="size-4" />К истории
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {c.workout.status === "active" ? "Круговая · активна" : "Круговая"}
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          {c.workout.name}
        </h1>
      </header>

      {c.workout.status === "active" ? (
        <ActiveCircuit
          workout={c.workout}
          exercises={c.exercises}
          logs={c.logs}
        />
      ) : (
        <CompletedCircuit
          workout={c.workout}
          exercises={c.exercises}
          logs={c.logs}
          analysis={analysis ?? null}
          jobStatus={job?.status ?? null}
        />
      )}
    </main>
  );
}
