import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Library,
  Plus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { LIBRARY_PROGRAMS, levelLabelRu } from "@/lib/domain/programs/library";
import {
  listPrograms,
  type ProgramListItem,
} from "@/lib/repos/training-programs.repo";

export const metadata: Metadata = { title: "Библиотека" };

/** Библиотека: мои тренировочные системы (программы) + готовые программы
 *  (статический TS-каталог). Системы тренируются из «Шаблонов» после
 *  «Начать тренироваться»; здесь их полка и управление. */
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
          Тренировочные системы — связки шаблонов-дней. Возьми готовую программу
          или собери свою. «Начать тренироваться» добавит её дни в «Шаблоны», а
          после прохождения тренер подгонит их под тебя.
        </p>
      </header>

      {/* Мои системы (программы). */}
      <section className="mb-7">
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

      {/* Готовые программы (каталог). */}
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
          Готовые программы
        </h2>
        <ul className="space-y-2">
          {LIBRARY_PROGRAMS.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/library/${p.slug}`}
                className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground mb-1 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] uppercase">
                    <Library className="size-3" />
                    {levelLabelRu(p.level)} · {p.frequency}
                  </p>
                  <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {p.days.length} дн. · {p.description}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
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
        <span className="text-muted-foreground block text-xs">
          {program.dayCount} дн. ·{" "}
          {program.active ? (
            <span className="text-primary font-medium">в Шаблонах</span>
          ) : (
            "на полке"
          )}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}
