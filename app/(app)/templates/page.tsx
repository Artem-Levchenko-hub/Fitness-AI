import {
  ChevronRight,
  Layers,
  Library,
  Pencil,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  formatTemplateMeta,
  mergeTemplateList,
  type UnifiedTemplateItem,
} from "@/lib/domain";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import {
  listPrograms,
  type ProgramListItem,
} from "@/lib/repos/training-programs.repo";
import { startCardioFromTemplateAction } from "@/server/actions/cardio-templates";
import { startCircuitFromTemplateAction } from "@/server/actions/circuit-templates";

export const metadata: Metadata = { title: "Шаблоны" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [strength, circuit, cardio, programs] = await Promise.all([
    listTemplates(user.id),
    listCircuitTemplates(user.id),
    listCardioTemplates(user.id),
    listPrograms(user.id),
  ]);
  const templates = mergeTemplateList(strength, circuit, cardio);
  const hasPrograms = programs.length > 0;
  const hasTemplates = templates.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          Шаблоны
        </h1>
        <Button asChild size="lg">
          {/* Точка выбора формата — после H14.4 создаваемы все 3 формата. */}
          <Link href="/create">
            <Plus className="size-4" />
            Новый
          </Link>
        </Button>
      </header>

      {/* Вход в библиотеку готовых программ — то, что атлет видит первым. */}
      <Link
        href="/library"
        className="from-primary/10 to-primary/5 border-primary/20 mb-5 flex min-h-[56px] items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 transition-colors hover:to-primary/10"
      >
        <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Library className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Библиотека</span>
          <span className="text-muted-foreground block text-xs">
            Готовые программы — возьми и тренируйся, тренер подгонит под тебя
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
      </Link>

      {/* Мои тренировочные системы (программы). */}
      {hasPrograms ? (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
              Мои системы
            </h2>
            <Link
              href="/programs/new"
              className="text-primary inline-flex items-center gap-1 text-xs font-medium"
            >
              <Layers className="size-3.5" />
              Собрать
            </Link>
          </div>
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id}>
                <ProgramRow program={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasPrograms ? (
        <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
          Мои шаблоны
        </h2>
      ) : null}

      {!hasTemplates ? (
        <EmptyState hasPrograms={hasPrograms} />
      ) : (
        <>
          <ul className="space-y-2">
            {templates.map((tpl) =>
              tpl.format === "strength" ? (
                <li key={`strength-${tpl.id}`}>
                  <Link
                    href={`/templates/${tpl.id}`}
                    className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                  >
                    <TemplateMeta tpl={tpl} />
                    <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                  </Link>
                </li>
              ) : (
                // Круговая и кардио переиспользуются стартом одним кликом —
                // форма с серверным экшеном формата (ноль дубля логики старта).
                <li key={`${tpl.format}-${tpl.id}`} className="flex gap-2">
                  <form
                    action={
                      tpl.format === "circuit"
                        ? startCircuitFromTemplateAction
                        : startCardioFromTemplateAction
                    }
                    className="min-w-0 flex-1"
                  >
                    <input type="hidden" name="templateId" value={tpl.id} />
                    <button
                      type="submit"
                      className="bg-card hover:bg-accent border-border flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors"
                    >
                      <TemplateMeta tpl={tpl} />
                      <span className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium">
                        <Play className="size-4 fill-current" />
                        Начать
                      </span>
                    </button>
                  </form>
                  <Link
                    href={`/templates/${tpl.format}/${tpl.id}/edit`}
                    aria-label={`Изменить шаблон «${tpl.name}»`}
                    className="bg-card hover:bg-accent border-border text-muted-foreground hover:text-foreground flex min-h-[56px] min-w-[56px] shrink-0 items-center justify-center rounded-xl border transition-colors"
                  >
                    <Pencil className="size-5" />
                  </Link>
                </li>
              ),
            )}
          </ul>

          {/* «Собрать систему» из своих шаблонов, когда систем ещё нет. */}
          {!hasPrograms ? (
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/programs/new">
                <Layers className="size-4" />
                Собрать систему из шаблонов
              </Link>
            </Button>
          ) : null}
        </>
      )}
    </main>
  );
}

function ProgramRow({ program }: { program: ProgramListItem }) {
  return (
    <Link
      href={`/programs/${program.id}`}
      className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
    >
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Layers className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        {program.librarySlug ? (
          <span className="text-muted-foreground mb-0.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] uppercase">
            <Library className="size-3" />
            из библиотеки
          </span>
        ) : null}
        <span className="block truncate text-sm font-semibold">
          {program.name}
        </span>
        <span className="text-muted-foreground block text-xs">
          {program.dayCount} дн.
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}

function TemplateMeta({ tpl }: { tpl: UnifiedTemplateItem }) {
  return (
    <div className="min-w-0 flex-1">
      {tpl.source === "trainer" ? (
        <p className="text-primary mb-1 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] uppercase">
          <Sparkles className="size-3" />
          Составил тренер
        </p>
      ) : null}
      <h2 className="truncate text-sm font-semibold">{tpl.name}</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatTemplateMeta(tpl)}
        {tpl.description ? ` · ${tpl.description}` : ""}
      </p>
    </div>
  );
}

function EmptyState({ hasPrograms }: { hasPrograms: boolean }) {
  return (
    <div className="bg-card border-border space-y-4 rounded-2xl border p-6 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
        <Plus className="size-6" />
      </div>
      <div>
        <h2 className="text-base font-semibold">
          {hasPrograms ? "Одиночных шаблонов пока нет" : "Шаблонов пока нет"}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Шаблон — это сохранённый план тренировки для повторного запуска.
          Сохранить как шаблон можно любой формат: силовую, круговую или кардио —
          прямо из его конструктора. Или возьми готовую программу из библиотеки.
        </p>
      </div>
      <Button asChild size="xl" className="w-full">
        <Link href="/create">Создать первый шаблон</Link>
      </Button>
    </div>
  );
}
