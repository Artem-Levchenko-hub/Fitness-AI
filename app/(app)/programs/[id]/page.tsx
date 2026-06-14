import {
  ChevronLeft,
  ChevronRight,
  Library,
  Play,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmDeleteButton } from "@/components/app/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getProgramWithDays } from "@/lib/repos/training-programs.repo";
import {
  activateProgramAction,
  deactivateProgramAction,
  deleteProgramAction,
} from "@/server/actions/training-programs";

export const metadata: Metadata = { title: "Тренировочная система" };

type Props = { params: Promise<{ id: string }> };

export default async function ProgramDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const program = await getProgramWithDays(user.id, id);
  if (!program) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/library">
          <ChevronLeft className="size-4" />
          Библиотека
        </Link>
      </Button>

      <header className="mb-5">
        {program.librarySlug ? (
          <p className="text-muted-foreground mb-1 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] uppercase">
            <Library className="size-3" />
            Из библиотеки
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {program.name}
        </h1>
        {program.description ? (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {program.description}
          </p>
        ) : null}
      </header>

      {/* «Начать тренироваться» = активировать: дни появятся в «Шаблонах». */}
      {program.active ? (
        <div className="border-primary/30 bg-primary/5 mb-5 flex items-center justify-between gap-3 rounded-2xl border p-4">
          <p className="text-sm font-medium">
            <span className="text-primary">В «Шаблонах».</span> Тренируйся днями
            оттуда.
          </p>
          <form action={deactivateProgramAction}>
            <input type="hidden" name="programId" value={program.id} />
            <Button type="submit" variant="ghost" size="sm">
              Убрать
            </Button>
          </form>
        </div>
      ) : (
        <form action={activateProgramAction} className="mb-5">
          <input type="hidden" name="programId" value={program.id} />
          <Button type="submit" size="xl" className="w-full">
            <Play className="size-4 fill-current" />
            Начать тренироваться
          </Button>
        </form>
      )}

      <p className="text-muted-foreground mb-3 text-xs">
        Дни системы. После каждого прохода тренер подгонит этот день под тебя —
        прямо в шаблоне.
      </p>

      <ol className="space-y-2">
        {program.days.map((day, idx) => (
          <li key={day.templateId}>
            <Link
              href={`/templates/${day.templateId}`}
              className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
            >
              <span className="text-muted-foreground bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {day.name}
                </span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  {day.exerciseCount} упр.
                  {day.adapted ? (
                    <span className="text-primary inline-flex items-center gap-1 font-medium">
                      <Sparkles className="size-3" />
                      адаптировано
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <ConfirmDeleteButton
          action={deleteProgramAction}
          hidden={{ programId: program.id }}
          title="Удалить систему?"
          description="Программа удалится, а её дни-шаблоны останутся в «Шаблонах» как одиночные. Выполненные тренировки сохранятся в истории."
          triggerLabel="Удалить систему"
          fullWidth
        />
      </div>
    </main>
  );
}
