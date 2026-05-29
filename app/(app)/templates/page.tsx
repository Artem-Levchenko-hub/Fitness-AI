import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listTemplates } from "@/lib/repos/templates.repo";

export const metadata: Metadata = { title: "Шаблоны" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const templates = await listTemplates(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          Шаблоны
        </h1>
        <Button asChild size="lg">
          <Link href="/templates/new">
            <Plus className="size-4" />
            Новый
          </Link>
        </Button>
      </header>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <Link
                href={`/templates/${tpl.id}`}
                className="bg-card hover:bg-accent border-border flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{tpl.name}</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {tpl.exerciseCount} упражнен
                    {pluralize(tpl.exerciseCount)}
                    {tpl.description ? ` · ${tpl.description}` : ""}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border-border space-y-4 rounded-2xl border p-6 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
        <Plus className="size-6" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Шаблонов пока нет</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Шаблон — это план тренировки: упорядоченный список упражнений с
          целевыми подходами, повторениями и весом.
        </p>
      </div>
      <Button asChild size="xl" className="w-full">
        <Link href="/templates/new">Создать первый шаблон</Link>
      </Button>
    </div>
  );
}

function pluralize(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "ие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ия";
  return "ий";
}
