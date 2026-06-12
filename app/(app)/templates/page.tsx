import { ChevronRight, Play, Plus } from "lucide-react";
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
import { startCardioFromTemplateAction } from "@/server/actions/cardio-templates";
import { startCircuitFromTemplateAction } from "@/server/actions/circuit-templates";

export const metadata: Metadata = { title: "Шаблоны" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const [strength, circuit, cardio] = await Promise.all([
    listTemplates(user.id),
    listCircuitTemplates(user.id),
    listCardioTemplates(user.id),
  ]);
  const templates = mergeTemplateList(strength, circuit, cardio);

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

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
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
              <li key={`${tpl.format}-${tpl.id}`}>
                <form
                  action={
                    tpl.format === "circuit"
                      ? startCircuitFromTemplateAction
                      : startCardioFromTemplateAction
                  }
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
              </li>
            ),
          )}
        </ul>
      )}
    </main>
  );
}

function TemplateMeta({ tpl }: { tpl: UnifiedTemplateItem }) {
  // Единая мета-строка (стиль Nike «Saved Workouts»): формат ведёт строку как
  // текст (R-41 — не только цвет), деталь формата — следом. Без отдельного
  // пилюли-бейджа: одна поверхность, не вкладки/разделы (столп 3).
  return (
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-sm font-semibold">{tpl.name}</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatTemplateMeta(tpl)}
        {tpl.description ? ` · ${tpl.description}` : ""}
      </p>
    </div>
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
          Шаблон — это сохранённый план тренировки для повторного запуска.
          Сохранить как шаблон можно любой формат: силовую, круговую или кардио —
          прямо из его конструктора.
        </p>
      </div>
      <Button asChild size="xl" className="w-full">
        <Link href="/create">Создать первый шаблон</Link>
      </Button>
    </div>
  );
}
