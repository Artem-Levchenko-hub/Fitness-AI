import { ChevronLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AiPlanBuilder } from "@/components/programs/AiPlanBuilder";
import { Button } from "@/components/ui/button";
import { isAiConfigured } from "@/lib/ai/plan-composer";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "План с ИИ-тренером" };

/** Интервью ИИ-тренера → персональный тренировочный план. Тренер задаёт вопросы
 *  (цель, опыт, частота, время, инвентарь, травмы) и собирает план тонко под
 *  клиента — в отличие от готовых пресетов. Создаётся как тренировочная система
 *  (/programs/[id]), активная сразу. */
export default async function AiPlanPage() {
  await requireUser();
  const aiOn = isAiConfigured();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-primary inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] uppercase">
          <Sparkles className="size-3.5" />
          ИИ-тренер
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Составим план под тебя
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Ответь на несколько вопросов — тренер подберёт упражнения, повторы и
          отдых под твою цель: рост мышц, силу, выносливость или восстановление.
          Учтёт травмы и доступный инвентарь.
        </p>
      </header>

      {aiOn ? <AiPlanBuilder /> : <AiOffNotice />}
    </main>
  );
}

function AiOffNotice() {
  return (
    <div className="bg-card border-border space-y-3 rounded-2xl border p-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        ИИ-тренер пока выключен. Чтобы он заработал, владельцу проекта нужно
        добавить ключ{" "}
        <code className="bg-muted rounded px-1 py-0.5">AI_API_KEY</code> или{" "}
        <code className="bg-muted rounded px-1 py-0.5">GEMINI_API_KEY</code> в{" "}
        <code className="bg-muted rounded px-1 py-0.5">.env.production</code> и
        перезапустить процесс.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">На главную</Link>
      </Button>
    </div>
  );
}
