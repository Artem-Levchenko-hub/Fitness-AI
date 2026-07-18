import { ChevronLeft, Pencil, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmDeleteButton } from "@/components/app/confirm-delete-button";
import { RevertAdaptationButton } from "@/components/templates/RevertAdaptationButton";
import { StartWorkoutButton } from "@/components/templates/StartWorkoutButton";
import { TemplateCoachPanel } from "@/components/templates/TemplateCoachPanel";
import { TemplateFocusHint } from "@/components/templates/TemplateFocusHint";
import { Button } from "@/components/ui/button";
import { extractPastAdvice } from "@/lib/ai/trainer-memory";
import { requireUser } from "@/lib/auth/require-user";
import { getTemplateWithItems } from "@/lib/repos/templates.repo";
import { getLastTemplateAnalysis } from "@/lib/repos/workouts.repo";
import { deleteTemplateAction } from "@/server/actions/templates";

export const metadata: Metadata = { title: "Шаблон" };

type Props = { params: Promise<{ id: string }> };

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const tpl = await getTemplateWithItems(user.id, id);
  if (!tpl) notFound();

  const lastAnalysis = await getLastTemplateAnalysis(user.id, id);
  const lastFocus = lastAnalysis ? extractPastAdvice(lastAnalysis).focus : null;

  // Подпись «обновлён тренером · <дата>». adaptedAt может быть null у шаблонов,
  // адаптированных ДО миграции 0023 (старый путь не писал дату) — тогда без даты.
  const adaptedLabel = tpl.adaptedAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(
        tpl.adaptedAt,
      )
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />
          Шаблоны
        </Link>
      </Button>

      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {tpl.name}
        </h1>
        {tpl.description ? (
          <p className="text-muted-foreground mt-2 text-sm">{tpl.description}</p>
        ) : null}
      </header>

      {tpl.lastAdaptedWorkoutId ? (
        // Тренер подогнал ЭТОТ шаблон под факт последней тренировки — он уже в
        // «Шаблонах», готов к старту. Откат возвращает оригинал (R-41 — иконка
        // + текст, не только цвет).
        <div className="border-border bg-muted/40 mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Wand2 className="text-primary size-4" aria-hidden="true" />
            Шаблон обновлён тренером{adaptedLabel ? ` · ${adaptedLabel}` : ""}
          </p>
          {tpl.canRevert ? (
            <RevertAdaptationButton templateId={tpl.id} />
          ) : null}
        </div>
      ) : null}

      {lastFocus && lastAnalysis ? (
        <TemplateFocusHint focus={lastFocus} analysisId={lastAnalysis.id} />
      ) : null}

      <StartWorkoutButton templateId={tpl.id} />

      <ol className="space-y-2">
        {tpl.items.map((item, idx) => (
          <li
            key={item.id}
            className="bg-card border-border flex items-start gap-3 rounded-xl border p-4"
          >
            <span className="text-muted-foreground bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {item.exerciseNameRu}
              </p>
              <div className="text-muted-foreground tabular mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {item.myoReps ? (
                  <span className="text-primary font-medium">
                    миорепсы: {item.targetRepsMin}–{item.targetRepsMax} +{" "}
                    {item.myoMiniSets}×{item.myoMiniReps} (отдых{" "}
                    {item.myoMiniRestSeconds}с)
                  </span>
                ) : (
                  <span>
                    {item.targetSets}×{item.targetRepsMin}–{item.targetRepsMax}
                  </span>
                )}
                {item.targetWeightKg ? (
                  <span>{item.targetWeightKg} кг</span>
                ) : null}
                <span>отдых {Math.round(item.targetRestSeconds)}с</span>
              </div>
              {item.notes ? (
                <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">
                  {item.notes}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <TemplateCoachPanel templateId={tpl.id} />

      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/templates/${tpl.id}/edit`}>
            <Pencil className="size-4" />
            Редактировать
          </Link>
        </Button>
        <ConfirmDeleteButton
          action={deleteTemplateAction}
          hidden={{ templateId: tpl.id }}
          title="Удалить шаблон?"
          description="Шаблон и его упражнения удалятся безвозвратно. Выполненные по нему тренировки останутся в истории."
          className="flex-1"
        />
      </div>
    </main>
  );
}
