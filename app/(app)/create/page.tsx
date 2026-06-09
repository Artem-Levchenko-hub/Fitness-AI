import { ChevronLeft, ChevronRight, Dumbbell, Repeat, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Создать тренировку" };

/** Единая точка входа «создать тренировку» — пикер формата с короткими
 *  пояснениями. Роутит в существующие билдеры (силовая / круговая / кардио).
 *  EMOM/Tabata/Norwegian — пресеты внутри кардио-билдера. */
export default async function CreateWorkoutPage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Новая тренировка
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Выбери формат
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Каждый формат — под свою цель. Выбери, и откроется нужный конструктор.
        </p>
      </header>

      <section className="space-y-3">
        {FORMATS.map((f) => (
          <FormatCard key={f.href} {...f} />
        ))}
      </section>
    </main>
  );
}

const FORMATS = [
  {
    href: "/templates/new",
    icon: Dumbbell,
    eyebrow: "Силовая",
    title: "Обычная тренировка",
    desc: "Классика: упражнения по очереди, подходы, вес × повторы, отдых между подходами.",
  },
  {
    href: "/circuits/new",
    icon: Repeat,
    eyebrow: "Круговая",
    title: "Круг (circuit)",
    desc: "Несколько упражнений подряд по кругу с минимальным отдыхом. Несколько раундов.",
  },
  {
    href: "/cardio/new",
    icon: Zap,
    eyebrow: "Кардио · HIIT",
    title: "Интервалы и кардио",
    desc: "Tabata · EMOM · Norwegian 4×4 · свой интервал. Работа/отдых по таймеру.",
  },
] as const;

function FormatCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  desc,
}: {
  href: string;
  icon: typeof Dumbbell;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-accent/40 border-border flex items-start gap-4 rounded-2xl border p-5 transition-colors"
    >
      <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {desc}
        </p>
      </div>
      <ChevronRight
        className="text-muted-foreground mt-1 size-5 shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}
