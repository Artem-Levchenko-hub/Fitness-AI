import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listExercises } from "@/lib/repos/exercises.repo";

import { CircuitBuilder } from "./circuit-builder";

export const metadata: Metadata = { title: "Новая круговая" };

export default async function NewCircuitPage() {
  const user = await requireUser();
  const exercises = await listExercises(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/circuits">
          <ChevronLeft className="size-4" />К истории
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Круговая
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Создать круговую
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Набор упражнений (повторения или время) × N кругов. Между упражнениями
          и кругами — настраиваемые паузы.
        </p>
      </header>

      <CircuitBuilder
        exercises={exercises.map((e) => ({
          id: e.id,
          nameRu: e.nameRu,
          nameEn: e.nameEn,
          isCustom: e.isCustom,
        }))}
      />
    </main>
  );
}
