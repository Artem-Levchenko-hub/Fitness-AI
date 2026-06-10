import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getCardioForUser } from "@/lib/repos/cardio.repo";

import { ActiveCardio } from "./active-cardio";
import { CompletedCardio } from "./completed-cardio";

export const metadata: Metadata = { title: "Кардио" };

type Props = { params: Promise<{ id: string }> };

export default async function CardioPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const c = await getCardioForUser(user.id, id);
  if (!c) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/workouts">
          <ChevronLeft className="size-4" />К истории
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {c.workout.status === "active" ? "Кардио · активно" : "Кардио"}
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          {c.workout.name}
        </h1>
      </header>

      {c.workout.status === "active" ? (
        <ActiveCardio workout={c.workout} blocks={c.blocks} />
      ) : (
        <CompletedCardio workout={c.workout} blocks={c.blocks} />
      )}
    </main>
  );
}
