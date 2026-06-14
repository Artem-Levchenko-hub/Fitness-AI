import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LIBRARY_PROGRAMS, levelLabelRu } from "@/lib/domain/programs/library";

export const metadata: Metadata = { title: "Библиотека программ" };

/** Библиотека готовых тренировочных систем — статический каталог (TS-данные,
 *  не БД). «Использовать» на странице программы копирует пресет к пользователю. */
export default function LibraryPage() {
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
          Готовые программы тренировок. Возьми любую — она скопируется к тебе, и
          после первого прохода тренер начнёт подгонять её под тебя: менять вес и
          повторы прямо в днях программы.
        </p>
      </header>

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
                <h2 className="truncate text-sm font-semibold">{p.name}</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {p.days.length} дн. · {p.description}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
