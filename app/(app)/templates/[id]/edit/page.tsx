import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listExercises } from "@/lib/repos/exercises.repo";
import { getTemplateWithItems } from "@/lib/repos/templates.repo";
import {
  updateMyoTemplateAction,
  updateTemplateAction,
} from "@/server/actions/templates";

import { TemplateBuilder, type BuilderItem } from "../../template-builder";

export const metadata: Metadata = { title: "Редактировать шаблон" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ scheme?: string | string[] }>;
};

export default async function EditTemplatePage({ params, searchParams }: Props) {
  const { id } = await params;
  const scheme = (await searchParams)?.scheme;
  const myoOnly = scheme === "myo_reps";
  const user = await requireUser();

  const [tpl, exercises] = await Promise.all([
    getTemplateWithItems(user.id, id),
    listExercises(user.id),
  ]);
  if (!tpl) notFound();

  const pickerData = exercises.map((e) => ({
    id: e.id,
    nameRu: e.nameRu,
    nameEn: e.nameEn,
    isCustom: e.isCustom,
  }));

  const initialItems: BuilderItem[] = tpl.items.map((it) => ({
    uid: it.id,
    exerciseId: it.exerciseId,
    targetSets: it.targetSets,
    targetRepsMin: it.targetRepsMin,
    targetRepsMax: it.targetRepsMax,
    targetWeightKg: it.targetWeightKg,
    targetRestSeconds: it.targetRestSeconds,
    myoReps: it.myoReps ?? false,
    myoMiniSets: it.myoMiniSets ?? 3,
    myoMiniReps: it.myoMiniReps ?? 5,
    myoMiniRestSeconds: it.myoMiniRestSeconds ?? 30,
    notes: it.notes ?? "",
  }));

  const action = (myoOnly ? updateMyoTemplateAction : updateTemplateAction).bind(
    null,
    id,
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href={`/templates/${id}`}>
          <ChevronLeft className="size-4" />
          К шаблону
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {myoOnly ? "Редактировать Myo-reps шаблон" : "Редактировать шаблон"}
        </h1>
      </header>

      <TemplateBuilder
        exercises={pickerData}
        initial={{
          name: tpl.name,
          description: tpl.description ?? "",
          items: initialItems,
        }}
        initialDefaultMyoReps={myoOnly}
        myoOnly={myoOnly}
        action={action}
        submitLabel="Сохранить"
      />
    </main>
  );
}
