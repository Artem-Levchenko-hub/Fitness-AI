import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Library,
  Play,
  Plus,
  Repeat,
  Wand2,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SwipeToDelete } from "@/components/app/swipe-to-delete";
import { Button } from "@/components/ui/button";
import { MyoRepsResearchNote } from "@/components/templates/MyoRepsResearchNote";
import { requireUser } from "@/lib/auth/require-user";
import {
  buildCardioTemplateRows,
  buildCircuitTemplateRows,
  formatExerciseCount,
  sortTemplatesForFlow,
  type TemplateCardRow,
} from "@/lib/domain";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import {
  listTemplates,
  type TemplateListItem,
} from "@/lib/repos/templates.repo";
import { startCardioFromTemplateAction } from "@/server/actions/cardio-templates";
import { startCircuitFromTemplateAction } from "@/server/actions/circuit-templates";
import { deleteTemplateFromListAction } from "@/server/actions/templates";

export const metadata: Metadata = { title: "Начать тренировку" };

/** Единая точка входа «начать тренировку». Силовая — главный поток: «Начать
 *  силовую» с твоими шаблонами, обновлённые тренером — первыми (sortTemplatesForFlow),
 *  свайп влево удаляет (SwipeToDelete). Всё «сгенерированное» (готовые программы +
 *  персональный ИИ-план) спрятано за одной неприметной ссылкой «Библиотека силовых»
 *  — не бросается в глаза. Круговая/кардио — вторичные форматы ниже (старт серверным
 *  экшеном по id, у них нет экрана старта). Силовая без шаблонов → прямой вход в
 *  конструктор + та же ссылка на библиотеку (столп 4 — ad-hoc сборка не теряется). */
export default async function CreateWorkoutPage() {
  const user = await requireUser();
  const [strength, circuit, cardio] = await Promise.all([
    listTemplates(user.id),
    listCircuitTemplates(user.id),
    listCardioTemplates(user.id),
  ]);
  const strengthSorted = sortTemplatesForFlow(strength);
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
          Начать силовую
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Выбери шаблон и в зал — обновлённые тренером сверху. Круговая и кардио —
          ниже.
        </p>
      </header>

      <section className="space-y-3">
        <StrengthStartCard templates={strengthSorted} />
        <MyoStarterCard />

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

/** Главный блок «Начать силовую»: твои силовые шаблоны крупными строками
 *  (обновлённые тренером — первыми, бейдж «обновлён тренером», R-41 иконка+текст),
 *  тап → экран старта `/templates/[id]`, свайп влево — удалить. Внизу — строка
 *  «создать новый» и неприметная ссылка «Библиотека силовых» (готовые программы +
 *  ИИ-план). 0 шаблонов (R-37) → прямой вход в конструктор + та же ссылка. */
function StrengthStartCard({ templates }: { templates: TemplateListItem[] }) {
  return (
    <div className="bg-card border-border rounded-2xl border p-5">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Dumbbell className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            Силовая
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight">
            Твои шаблоны
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {templates.length > 0
              ? "Тап — начать. Свайп влево — удалить."
              : "Собери первый шаблон или возьми готовую программу в библиотеке."}
          </p>
        </div>
      </div>

      {templates.length > 0 ? (
        <ul className="border-border mt-4 space-y-2 border-t pt-4">
          {templates.map((t) => (
            <li key={t.id}>
              <SwipeToDelete
                action={deleteTemplateFromListAction}
                hidden={{ templateId: t.id }}
                title="Удалить шаблон?"
                description={`«${t.name}» удалится безвозвратно. Выполненные по нему тренировки останутся в истории.`}
                deleteAriaLabel={`Удалить шаблон «${t.name}»`}
              >
                <Link
                  href={`/templates/${t.id}`}
                  className="bg-background hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatExerciseCount(t.exerciseCount)}
                    </p>
                    {t.hasMyoReps ? (
                      <span className="text-primary mt-1 inline-flex items-center gap-1 text-[10px] font-medium">
                        <Zap className="size-3" aria-hidden="true" />
                        Myo-reps
                      </span>
                    ) : null}
                    {t.adapted || t.source === "trainer" ? (
                      <span className="text-primary mt-1 inline-flex items-center gap-1 text-[10px] font-medium">
                        <Wand2 className="size-3" aria-hidden="true" />
                        обновлён тренером
                      </span>
                    ) : null}
                  </div>
                  <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
                    <Play className="size-4 fill-current" aria-hidden="true" />
                    Начать
                  </span>
                </Link>
              </SwipeToDelete>
            </li>
          ))}
          <li>
            <Link
              href="/templates/new"
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium transition-colors"
            >
              <Plus className="size-4" aria-hidden="true" />
              Создать новый шаблон
            </Link>
          </li>
        </ul>
      ) : (
        <div className="border-border mt-4 border-t pt-4">
          <Button asChild size="lg" className="min-h-[56px] w-full">
            <Link href="/templates/new">
              <Plus className="size-4" />
              Собрать первый шаблон
            </Link>
          </Button>
        </div>
      )}

      {/* Менее выраженный вход: готовые программы + персональный ИИ-план. */}
      <Link
        href="/library"
        className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
      >
        <Library className="size-3.5" aria-hidden="true" />
        Библиотека силовых
      </Link>
    </div>
  );
}

function MyoStarterCard() {
  return (
    <div className="bg-card border-border rounded-2xl border p-5">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Zap className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            Силовая · отдельный формат
          </p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight">
            Myo-reps
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Отдельный вход для короткого кластера: активационный подход и
            мини-подходы с коротким отдыхом. Не прячется внутри «своего
            формата».
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <MyoRepsResearchNote compact />
        <Button asChild size="lg" className="min-h-[56px] w-full">
          <Link href="/templates/new?scheme=myo_reps">
            <Zap className="size-4" />
            Создать Myo-reps шаблон
          </Link>
        </Button>
      </div>
    </div>
  );
}

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

/** Карточка формата с раскрытым списком существующих шаблонов (круговая/кардио).
 *  Шапка неинтерактивна, ниже — строки шаблонов (старт POST-экшеном по id —
 *  у этих форматов нет экрана старта) и строка «создать новый» (тап ≥56px, R-41). */
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
  startAction: (formData: FormData) => void | Promise<void>;
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
