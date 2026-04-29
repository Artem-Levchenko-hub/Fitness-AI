import { ChevronLeft, Pencil, Play, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getTemplateWithItems } from "@/lib/repos/templates.repo";
import { deleteTemplateAction } from "@/server/actions/templates";
import { startWorkoutFromTemplateAction } from "@/server/actions/workouts";

export const metadata: Metadata = { title: "Шаблон" };

type Props = { params: Promise<{ id: string }> };

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const tpl = await getTemplateWithItems(user.id, id);
  if (!tpl) notFound();

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

      <form action={startWorkoutFromTemplateAction} className="mb-6">
        <input type="hidden" name="templateId" value={tpl.id} />
        <Button type="submit" size="xl" className="w-full">
          <Play className="size-5" />
          Начать тренировку
        </Button>
      </form>

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
                <span>
                  {item.targetSets}×{item.targetRepsMin}–{item.targetRepsMax}
                </span>
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

      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href={`/templates/${tpl.id}/edit`}>
            <Pencil className="size-4" />
            Редактировать
          </Link>
        </Button>
        <form action={deleteTemplateAction} className="flex-1">
          <input type="hidden" name="templateId" value={tpl.id} />
          <Button
            type="submit"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
          >
            <Trash2 className="size-4" />
            Удалить
          </Button>
        </form>
      </div>
    </main>
  );
}
