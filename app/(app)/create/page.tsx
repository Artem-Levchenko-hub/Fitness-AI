import { ChevronLeft, ChevronRight, Dumbbell, Plus, Repeat, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  buildStrengthTemplateRows,
  type StrengthTemplateRow,
} from "@/lib/domain";
import { listTemplates } from "@/lib/repos/templates.repo";

export const metadata: Metadata = { title: "Создать тренировку" };

/** Единая точка входа «создать тренировку» — пикер формата с короткими
 *  пояснениями. Силовая (H12.2): при ≥1 шаблоне карточка раскрывает список
 *  шаблонов юзера (тап → экран старта `/templates/[id]`, где живут совет и
 *  кнопка старта — повтор за ≤2 тапа от дашборда) + строку «Создать новый
 *  шаблон»; при 0 шаблонов — сразу конструктор (как раньше). Круговая/кардио —
 *  прямой вход в свои билдеры. EMOM/Tabata/Norwegian — пресеты внутри кардио. */
export default async function CreateWorkoutPage() {
  const user = await requireUser();
  const strengthRows = buildStrengthTemplateRows(await listTemplates(user.id));

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
        {strengthRows.length > 0 ? (
          <FormatTemplateCard
            icon={Dumbbell}
            eyebrow="Силовая"
            title="Обычная тренировка"
            desc="Повтори один из своих шаблонов или собери новый."
            rows={strengthRows}
            createHref="/templates/new"
            createLabel="Создать новый шаблон"
          />
        ) : (
          <FormatCard {...STRENGTH_BUILDER} />
        )}
        {OTHER_FORMATS.map((f) => (
          <FormatCard key={f.href} {...f} />
        ))}
      </section>
    </main>
  );
}

/** Силовая без шаблонов — прямой вход в конструктор (status quo). */
const STRENGTH_BUILDER = {
  href: "/templates/new",
  icon: Dumbbell,
  eyebrow: "Силовая",
  title: "Обычная тренировка",
  desc: "Классика: упражнения по очереди, подходы, вес × повторы, отдых между подходами.",
} as const;

const OTHER_FORMATS = [
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

/** Карточка формата с раскрытым списком существующих шаблонов. Общий носитель
 *  раскрытия (тап-строка ≥56px, R-41): шапка-заголовок неинтерактивна, ниже —
 *  строки шаблонов (Link → href) и одна строка «создать новый». Спроектирован
 *  generic над list-строками, чтобы круговая/кардио позже раскрылись тем же
 *  компонентом (H12.2-хвост) — один паттерн, не три расходящихся (урок H4.3). */
function FormatTemplateCard({
  icon: Icon,
  eyebrow,
  title,
  desc,
  rows,
  createHref,
  createLabel,
}: {
  icon: typeof Dumbbell;
  eyebrow: string;
  title: string;
  desc: string;
  rows: StrengthTemplateRow[];
  createHref: string;
  createLabel: string;
}) {
  return (
    <div className="bg-card border-border rounded-2xl border p-5">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {desc}
          </p>
        </div>
      </div>

      <ul className="border-border mt-4 space-y-2 border-t pt-4">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="bg-background hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {row.meta}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={createHref}
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" />
            {createLabel}
          </Link>
        </li>
      </ul>
    </div>
  );
}

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
