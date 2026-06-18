import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Library,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { pluralDays } from "@/lib/domain/programs/library";
import {
  listPrograms,
  type ProgramListItem,
} from "@/lib/repos/training-programs.repo";

export const metadata: Metadata = { title: "Библиотека" };

/** Библиотека: мои тренировочные системы (программы). Готовые «базовые» пресеты
 *  убраны — вместо них персональный план от ИИ-тренера, который подбирается тонко
 *  под цель и травмы клиента. Системы тренируются из «Шаблонов» после
 *  «Начать тренироваться». */
export default async function LibraryPage() {
  const user = await requireUser();
  const programs = await listPrograms(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />
          Шаблоны
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          Библиотека
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Тренировочные системы — связки шаблонов-дней. Попроси ИИ-тренера собрать
          план под тебя или собери систему из своих шаблонов. После прохождения
          тренер подгонит дни под тебя.
        </p>
      </header>

      {/* Персональный план от ИИ-тренера — вместо готовых пресетов. */}
      <Link
        href="/programs/ai"
        className="border-primary/30 from-primary/10 to-primary/5 hover:to-primary/10 mb-7 flex items-start gap-4 rounded-2xl border bg-gradient-to-br p-5 transition-colors"
      >
        <span className="bg-primary/15 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-primary block text-[10px] font-medium tracking-[0.18em] uppercase">
            ИИ-тренер
          </span>
          <span className="mt-0.5 block text-base font-semibold tracking-tight">
            Составить персональный план
          </span>
          <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
            Цель, опыт, инвентарь, травмы — тренер подберёт упражнения, повторы и
            отдых тонко под тебя. Гипертрофия, сила, выносливость, колени.
          </span>
        </span>
        <ChevronRight className="text-muted-foreground mt-1 size-5 shrink-0" />
      </Link>

      {/* Мои системы (программы). */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
            Мои системы
          </h2>
          <Link
            href="/programs/new"
            className="text-primary inline-flex items-center gap-1 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            Собрать
          </Link>
        </div>

        {programs.length === 0 ? (
          <Link
            href="/programs/new"
            className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center gap-3 rounded-xl border border-dashed p-4 transition-colors"
          >
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Layers className="size-4" />
            </span>
            <span className="text-muted-foreground text-sm">
              Собрать систему из своих шаблонов
            </span>
          </Link>
        ) : (
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id}>
                <ProgramRow program={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ProgramRow({ program }: { program: ProgramListItem }) {
  return (
    <Link
      href={`/programs/${program.id}`}
      className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
    >
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Layers className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        {program.librarySlug ? (
          <span className="text-muted-foreground mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
            <Library className="size-3" />
            из библиотеки
          </span>
        ) : null}
        <span className="block truncate text-sm font-semibold">
          {program.name}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground tabular-nums">
            {program.dayCount} {pluralDays(program.dayCount)}
          </span>
          {program.active ? (
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
              <Check className="size-3" />в Шаблонах
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
              <Archive className="size-3" />
              на полке
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}
