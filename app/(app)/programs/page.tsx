import { ChevronLeft, ChevronRight, Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listPrograms } from "@/lib/repos/training-programs.repo";

export const metadata: Metadata = { title: "Мои планы" };

/** «Мои планы» — тренировочные программы атлета (собранные из шаблонов, из
 *  библиотеки или составленные ИИ). Прямой вход в сборку плана из своих
 *  шаблонов — без захода в Библиотеку. */
export default async function ProgramsPage() {
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
          Мои планы
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          План — это несколько твоих тренировок, собранных в программу. Тренер
          оценит её целиком и будет вести день за днём.
        </p>
      </header>

      <Button asChild size="xl" className="mb-6 w-full">
        <Link href="/programs/new">
          <Plus className="size-5" />
          Собрать план из шаблонов
        </Link>
      </Button>

      {programs.length === 0 ? (
        <div className="bg-card border-border rounded-2xl border border-dashed p-6 text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
            <Layers className="size-6" />
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Планов пока нет. Выбери несколько своих шаблонов — и собери из них
            программу. Или возьми готовую в{" "}
            <Link href="/library" className="text-primary font-medium">
              Библиотеке
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {programs.map((p) => (
            <li key={p.id}>
              <Link
                href={`/programs/${p.id}`}
                className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {p.name}
                  </span>
                  <span className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    {p.dayCount} дн.
                    {p.active ? (
                      <span className="text-primary font-medium">активна</span>
                    ) : (
                      <span>на полке</span>
                    )}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
