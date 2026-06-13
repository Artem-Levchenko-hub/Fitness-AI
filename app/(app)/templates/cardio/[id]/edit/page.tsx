import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { PRESET_META, toCardioEditInitial } from "@/lib/domain";
import { getCardioTemplateForEdit } from "@/lib/repos/cardio-templates.repo";
import { updateCardioTemplateAction } from "@/server/actions/cardio-templates";

import { CardioEditForm } from "./cardio-edit-form";

export const metadata: Metadata = { title: "Редактировать кардио" };

type Props = { params: Promise<{ id: string }> };

export default async function EditCardioTemplatePage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const tpl = await getCardioTemplateForEdit(user.id, id);
  if (!tpl) notFound();

  const initial = toCardioEditInitial(tpl);
  // Бинд templateId в server-action (прецедент силового updateTemplateAction.bind).
  const action = updateCardioTemplateAction.bind(null, id);

  const presetLabel =
    initial.preset === "custom"
      ? "Свой формат"
      : PRESET_META[initial.preset].nameRu;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />К шаблонам
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Кардио · {presetLabel}
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Редактировать шаблон
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Поменяй параметры — изменения сохранятся в шаблон и применятся при
          следующем запуске.
        </p>
      </header>

      <CardioEditForm action={action} initial={initial} />
    </main>
  );
}
