import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { toCircuitBuilderInitial } from "@/lib/domain";
import { getCircuitTemplateForEdit } from "@/lib/repos/circuit-templates.repo";
import { listExercises } from "@/lib/repos/exercises.repo";

import { CircuitBuilder } from "../../../../circuits/new/circuit-builder";

export const metadata: Metadata = { title: "Редактировать круговую" };

type Props = { params: Promise<{ id: string }> };

export default async function EditCircuitTemplatePage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const [tpl, exercises] = await Promise.all([
    getCircuitTemplateForEdit(user.id, id),
    listExercises(user.id),
  ]);
  if (!tpl) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />К шаблонам
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Круговая
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Редактировать шаблон
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Поменяй упражнения, круги и паузы — изменения сохранятся в шаблон и
          применятся при следующем запуске.
        </p>
      </header>

      <CircuitBuilder
        exercises={exercises.map((e) => ({
          id: e.id,
          nameRu: e.nameRu,
          nameEn: e.nameEn,
          isCustom: e.isCustom,
        }))}
        initial={toCircuitBuilderInitial(tpl)}
      />
    </main>
  );
}
