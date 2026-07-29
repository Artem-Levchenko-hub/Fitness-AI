import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SetScheme } from "@/lib/domain/workouts/myo-reps";
import { requireUser } from "@/lib/auth/require-user";
import { listExercises } from "@/lib/repos/exercises.repo";
import { createTemplateAction } from "@/server/actions/templates";

import { TemplateBuilder } from "../template-builder";

export const metadata: Metadata = { title: "Новый шаблон" };

type Props = {
  searchParams?: Promise<{ scheme?: string }>;
};

export default async function NewTemplatePage({ searchParams }: Props) {
  const user = await requireUser();
  const schemeParam = (await searchParams)?.scheme;
  const initialDefaultScheme: SetScheme =
    schemeParam === "myo_reps" ? "myo_reps" : "straight";
  const exercises = await listExercises(user.id);
  const pickerData = exercises.map((e) => ({
    id: e.id,
    nameRu: e.nameRu,
    nameEn: e.nameEn,
    isCustom: e.isCustom,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />
          Шаблоны
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Новый шаблон
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Соберите план тренировки. Перетаскивайте упражнения, чтобы поменять
          порядок.
        </p>
      </header>

      <TemplateBuilder
        exercises={pickerData}
        initialDefaultScheme={initialDefaultScheme}
        action={createTemplateAction}
        submitLabel={
          initialDefaultScheme === "myo_reps"
            ? "Создать Myo-reps шаблон"
            : "Создать шаблон"
        }
      />
    </main>
  );
}
