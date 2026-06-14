import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProgramWrapBuilder } from "@/components/programs/program-wrap-builder";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { listTemplates } from "@/lib/repos/templates.repo";

export const metadata: Metadata = { title: "Новая система" };

/** Обернуть свои силовые шаблоны в тренировочную систему. Дни = выбранные
 *  шаблоны (адаптация на месте включается для них после первого прохода). */
export default async function NewProgramPage() {
  const user = await requireUser();
  const templates = await listTemplates(user.id);
  const options = templates.map((t) => ({
    id: t.id,
    name: t.name,
    exerciseCount: t.exerciseCount,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/templates">
          <ChevronLeft className="size-4" />
          Шаблоны
        </Link>
      </Button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Собрать систему
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Объедините свои шаблоны в программу — тренер будет вести её и подгонять
          каждый день под вас.
        </p>
      </header>

      <ProgramWrapBuilder templates={options} />
    </main>
  );
}
