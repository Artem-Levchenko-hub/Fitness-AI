import {
  ChevronRight,
  Layers,
  Library,
  Pencil,
  Play,
  Plus,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SwipeToDelete } from "@/components/app/swipe-to-delete";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  formatTemplateMeta,
  mergeTemplateList,
  sortTemplatesForFlow,
  type UnifiedTemplateItem,
} from "@/lib/domain";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { startCardioFromTemplateAction } from "@/server/actions/cardio-templates";
import { startCircuitFromTemplateAction } from "@/server/actions/circuit-templates";
import { deleteTemplateFromListAction } from "@/server/actions/templates";

export const metadata: Metadata = { title: "Шаблоны" };

export default async function TemplatesPage() {
  const user = await requireUser();
  // listTemplates отдаёт одиночные шаблоны + дни АКТИВНЫХ систем; дни систем на
  // полке (неактивных) сюда не попадают — они живут в Библиотеке.
  const [strength, circuit, cardio] = await Promise.all([
    listTemplates(user.id),
    listCircuitTemplates(user.id),
    listCardioTemplates(user.id),
  ]);
  // Поток «в зал»: обновлённые тренером шаблоны (adapted / source="trainer") —
  // первыми, остальное по свежести (sortTemplatesForFlow). Главный шаблон «под
  // тебя» от ИИ-тренера виден и здесь, и в «Начать» — единый простой список.
  const templates = sortTemplatesForFlow(
    mergeTemplateList(strength, circuit, cardio),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-4 flex items-center justify-between gap-3">
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

      {/* Входы уровнем выше шаблона: «Мои планы» (собрать программу из своих
          тренировок + оценка тренера) и Библиотека готовых. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/programs"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
        >
          <Layers className="size-3.5" aria-hidden="true" />
          Мои планы
        </Link>
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
        >
          <Library className="size-3.5" aria-hidden="true" />
          Библиотека силовых
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {templates.map((tpl) =>
            tpl.format === "strength" ? (
              <li key={`strength-${tpl.id}`}>
                {/* Свайп влево — удалить (как в «Начать» и в истории). Тап —
                    экран старта/деталей шаблона. */}
                <SwipeToDelete
                  action={deleteTemplateFromListAction}
                  hidden={{ templateId: tpl.id }}
                  title="Удалить шаблон?"
                  description={`«${tpl.name}» удалится безвозвратно. Выполненные по нему тренировки останутся в истории.`}
                  deleteAriaLabel={`Удалить шаблон «${tpl.name}»`}
                >
                  <Link
                    href={`/templates/${tpl.id}`}
                    className="bg-card hover:bg-accent border-border flex min-h-[56px] items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                  >
                    <TemplateMeta tpl={tpl} />
                    <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                  </Link>
                </SwipeToDelete>
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
      )}
    </main>
  );
}

function TemplateMeta({ tpl }: { tpl: UnifiedTemplateItem }) {
  return (
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-sm font-semibold">{tpl.name}</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatTemplateMeta(tpl)}
        {tpl.description ? ` · ${tpl.description}` : ""}
      </p>
      {tpl.adapted ? (
        // Тренер подогнал шаблон под факт последней тренировки (R-41 — не только
        // цвет: иконка + текст).
        <span className="text-primary mt-1 inline-flex items-center gap-1 text-[10px] font-medium">
          <Wand2 className="size-3" aria-hidden="true" />
          обновлён тренером
        </span>
      ) : null}
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
          прямо из его конструктора. Или возьми готовую программу в Библиотеке.
        </p>
      </div>
      <Button asChild size="xl" className="w-full">
        <Link href="/create">Создать первый шаблон</Link>
      </Button>
    </div>
  );
}
