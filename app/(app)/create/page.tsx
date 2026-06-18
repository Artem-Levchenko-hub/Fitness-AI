import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Play,
  Plus,
  Repeat,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  buildCardioTemplateRows,
  buildCircuitTemplateRows,
  buildStrengthTemplateRows,
  type TemplateCardRow,
} from "@/lib/domain";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { startCardioFromTemplateAction } from "@/server/actions/cardio-templates";
import { startCircuitFromTemplateAction } from "@/server/actions/circuit-templates";

export const metadata: Metadata = { title: "Создать тренировку" };

/** Единая точка входа «создать тренировку» — пикер формата с короткими
 *  пояснениями. При ≥1 шаблоне формата карточка раскрывает список шаблонов
 *  юзера — повтор за ≤2 тапа от дашборда (H12.2): силовая → тап в экран старта
 *  `/templates/[id]`; круговая/кардио → форма-кнопка «Начать» (старт серверным
 *  экшеном по id — у них нет экрана старта); + строка «Создать новый» внизу
 *  (ad-hoc «с нуля» не теряется — столп 4). При 0 шаблонов формата — прямой вход
 *  в его конструктор (как раньше). EMOM/Tabata/Norwegian — пресеты внутри
 *  кардио. Один носитель раскрытия для всех форматов (урок H4.3). */
export default async function CreateWorkoutPage() {
  const user = await requireUser();
  const [strength, circuit, cardio] = await Promise.all([
    listTemplates(user.id),
    listCircuitTemplates(user.id),
    listCardioTemplates(user.id),
  ]);
  const strengthRows = buildStrengthTemplateRows(strength);
  const circuitRows = buildCircuitTemplateRows(circuit);
  const cardioRows = buildCardioTemplateRows(cardio);

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
        {/* Персональный план от ИИ-тренера — отдельный вход «над форматами»:
            тренер подбирает упражнения под цель/травмы, в отличие от ручной
            сборки шаблона ниже. */}
        <Link
          href="/programs/ai"
          className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:to-primary/10 flex items-start gap-4 rounded-2xl border p-5 transition-colors"
        >
          <div className="bg-primary/15 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-primary text-[10px] font-medium tracking-[0.18em] uppercase">
              ИИ-тренер
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight">
              Составить план под себя
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Ответь на пару вопросов о цели и травмах — тренер соберёт
              персональную программу: рост мышц, сила, выносливость, колени.
            </p>
          </div>
          <ChevronRight
            className="text-muted-foreground mt-1 size-5 shrink-0"
            aria-hidden="true"
          />
        </Link>

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

        {circuitRows.length > 0 ? (
          <FormatTemplateCard
            icon={Repeat}
            eyebrow="Круговая"
            title="Круг (circuit)"
            desc="Повтори свой круг или собери новый."
            rows={circuitRows}
            startAction={startCircuitFromTemplateAction}
            createHref="/circuits/new"
            createLabel="Создать новую круговую"
          />
        ) : (
          <FormatCard {...CIRCUIT_BUILDER} />
        )}

        {cardioRows.length > 0 ? (
          <FormatTemplateCard
            icon={Zap}
            eyebrow="Кардио · HIIT"
            title="Интервалы и кардио"
            desc="Повтори свой интервал или собери новый."
            rows={cardioRows}
            startAction={startCardioFromTemplateAction}
            createHref="/cardio/new"
            createLabel="Создать новое кардио"
          />
        ) : (
          <FormatCard {...CARDIO_BUILDER} />
        )}
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

const CIRCUIT_BUILDER = {
  href: "/circuits/new",
  icon: Repeat,
  eyebrow: "Круговая",
  title: "Круг (circuit)",
  desc: "Несколько упражнений подряд по кругу с минимальным отдыхом. Несколько раундов.",
} as const;

const CARDIO_BUILDER = {
  href: "/cardio/new",
  icon: Zap,
  eyebrow: "Кардио · HIIT",
  title: "Интервалы и кардио",
  desc: "Tabata · EMOM · Norwegian 4×4 · свой интервал. Работа/отдых по таймеру.",
} as const;

/** Карточка формата с раскрытым списком существующих шаблонов. Общий носитель
 *  раскрытия для ВСЕХ трёх форматов (урок H4.3 — один паттерн, не три): шапка
 *  неинтерактивна, ниже — строки шаблонов и одна строка «создать новый» (тап
 *  ≥56px, R-41). Силовая (без `startAction`) — строки-Link на экран старта
 *  `/templates/[id]`. Круговая/кардио (`startAction` задан) — у них нет экрана
 *  старта, поэтому строка = форма-кнопка «Начать» (POST-экшен по id, зеркало
 *  /templates). /create — поверхность ПОВТОРА; редактирование шаблона живёт на
 *  /templates («управление»), поэтому здесь строки старт-only. */
function FormatTemplateCard({
  icon: Icon,
  eyebrow,
  title,
  desc,
  rows,
  startAction,
  createHref,
  createLabel,
}: {
  icon: typeof Dumbbell;
  eyebrow: string;
  title: string;
  desc: string;
  rows: TemplateCardRow[];
  startAction?: (formData: FormData) => void | Promise<void>;
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
            {startAction ? (
              <form action={startAction}>
                <input type="hidden" name="templateId" value={row.id} />
                <button
                  type="submit"
                  className="bg-background hover:bg-accent border-border flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors"
                >
                  <TemplateRowMeta name={row.name} meta={row.meta} />
                  <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
                    <Play className="size-4 fill-current" aria-hidden="true" />
                    Начать
                  </span>
                </button>
              </form>
            ) : (
              <Link
                href={row.href ?? createHref}
                className="bg-background hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
              >
                <TemplateRowMeta name={row.name} meta={row.meta} />
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              </Link>
            )}
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

function TemplateRowMeta({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold">{name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{meta}</p>
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
