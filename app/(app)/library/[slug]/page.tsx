import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UseProgramButton } from "@/components/programs/use-program-button";
import { Button } from "@/components/ui/button";
import { EXERCISES } from "@/db/seed/exercises.seed";
import { getLibraryProgram, levelLabelRu } from "@/lib/domain/programs/library";

export const metadata: Metadata = { title: "Программа" };

type Props = { params: Promise<{ slug: string }> };

/** Имена системных упражнений по slug — из того же seed-каталога, что и БД
 *  (источник истины для системных названий). Без БД-запроса: страница статична. */
const NAME_BY_SLUG = new Map(EXERCISES.map((e) => [e.slug, e.nameRu]));

export default async function LibraryProgramPage({ params }: Props) {
  const { slug } = await params;
  const program = getLibraryProgram(slug);
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
        <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-[0.1em] uppercase">
          {levelLabelRu(program.level)} · {program.frequency}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {program.name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {program.description}
        </p>
      </header>

      <UseProgramButton librarySlug={program.slug} />

      <div className="space-y-4">
        {program.days.map((day, dayIdx) => (
          <section
            key={dayIdx}
            className="bg-card border-border rounded-2xl border p-4"
          >
            <h2 className="mb-3 text-sm font-semibold">
              <span className="text-muted-foreground tabular-nums">
                {dayIdx + 1}.
              </span>{" "}
              {day.name}
            </h2>
            <ul className="space-y-2">
              {day.items.map((it, i) => (
                <li
                  key={i}
                  className="border-border/60 flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {NAME_BY_SLUG.get(it.exerciseSlug) ?? it.exerciseSlug}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {it.targetSets}×{it.targetRepsMin}–{it.targetRepsMax}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
