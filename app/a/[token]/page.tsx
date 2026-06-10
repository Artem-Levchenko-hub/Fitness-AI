import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  TrainerResultCard,
  type TrainerResultData,
} from "@/components/trainer/TrainerResultCard";
import { Button } from "@/components/ui/button";
import { trainerSchema } from "@/lib/ai/trainer-structured";
import { getSharedAnalysis } from "@/lib/repos/workouts.repo";

// Чужие разборы не должны попадать в индекс поисковиков (capability-токен =
// право доступа, не публичный контент для краулеров).
export const metadata: Metadata = {
  title: "Разбор тренировки",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

export default async function SharedAnalysisPage({ params }: Props) {
  const { token } = await params;

  // R-7-исключение: сам токен — право доступа, без userId-фильтра. Repo
  // отдаёт только non-PII (никакого userId/email).
  const analysis = await getSharedAnalysis(token);
  if (!analysis) notFound();

  // resultJson сохранялся уже валидированным, но проверяем повторно: при
  // успехе — цветные дельты F4, иначе fallback на markdown content.
  const parsed = trainerSchema.safeParse(analysis.resultJson);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-12 md:px-8 md:pt-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Поделились разбором
          </p>
          <h1 className="font-serif mt-0.5 truncate text-2xl font-normal tracking-tight md:text-3xl">
            AI-разбор тренировки
          </h1>
        </div>
      </header>

      {parsed.success ? (
        <TrainerResultCard data={parsed.data as TrainerResultData} />
      ) : (
        <article className="bg-card text-card-foreground border-border rounded-2xl border p-6 text-sm leading-relaxed whitespace-pre-wrap">
          {analysis.content}
        </article>
      )}

      <section className="border-border mt-8 rounded-2xl border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Свой AI-разбор силовых тренировок — в Fitness SaaS.
        </p>
        <Button asChild variant="outline" className="mt-3 min-h-14">
          <Link href="/">Узнать больше</Link>
        </Button>
      </section>
    </main>
  );
}
