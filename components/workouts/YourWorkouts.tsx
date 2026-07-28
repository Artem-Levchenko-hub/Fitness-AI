import {
  Check,
  ChevronRight,
  History,
  Pin,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { StartWorkoutButton } from "@/components/templates/StartWorkoutButton";
import { Button } from "@/components/ui/button";
import type { PinnedTemplateItem } from "@/lib/repos/templates.repo";
import {
  confirmTemplateVersionAction,
  restoreTemplateVersionAction,
} from "@/server/actions/templates";

const MIN_HISTORY = 10;

export function YourWorkouts({
  templates,
}: {
  templates: PinnedTemplateItem[];
}) {
  return (
    <section className="mb-10" data-testid="your-workouts">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-primary text-xs font-medium tracking-[0.18em] uppercase">
            Следующая тренировка
          </p>
          <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
            Твои тренировки
          </h1>
        </div>
        <Link
          href="/templates"
          className="text-muted-foreground hover:text-foreground text-xs font-medium"
        >
          Настроить
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="border-border bg-card rounded-2xl border p-5">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
              <Pin className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Закрепи основные программы
              </h2>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Выбери до пяти шаблонов. После каждой завершённой сессии тренер
                будет готовить следующую версию именно этой тренировки.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/templates">Выбрать тренировки</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <NextWorkoutCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </section>
  );
}

function NextWorkoutCard({ template }: { template: PinnedTemplateItem }) {
  const version = template.latestVersion;
  const collecting = template.relevantWorkoutCount < MIN_HISTORY;
  const pendingConfirmation =
    version?.source === "trainer" &&
    version.requiresConfirmation &&
    version.confirmedAt == null;

  return (
    <article className="border-border bg-card overflow-hidden rounded-2xl border">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              Программа {template.pinnedPosition}
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">
              {template.name}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              {template.exerciseCount} упр.
              {template.hasMyoReps ? " · Myo-reps" : ""}
              {version
                ? pendingConfirmation
                  ? ` · предложение ${version.versionNumber}`
                  : ` · версия ${version.versionNumber}`
                : ""}
            </p>
          </div>
          {version?.source === "trainer" ? (
            <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium uppercase">
              <Sparkles className="size-3" />
              Тренер
            </span>
          ) : template.hasMyoReps ? (
            <Zap className="text-primary size-4 shrink-0" aria-label="Myo-reps" />
          ) : null}
        </div>

        <div className="bg-muted/45 mt-4 rounded-xl p-3">
          <p className="text-sm font-medium">
            {collecting
              ? `Собираю историю: ${template.relevantWorkoutCount}/${MIN_HISTORY}`
              : version?.summary ?? "Текущая версия готова"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {collecting
              ? "До десяти сопоставимых сессий тренер не делает автоматических изменений. Можно выполнять текущий шаблон."
              : version?.rationale ??
                "Параметры сохранены без автоматической коррекции."}
          </p>
          {!collecting && version?.confidence != null ? (
            <p className="text-muted-foreground mt-2 text-[10px] font-medium tracking-wide uppercase">
              Уверенность {Math.round(version.confidence * 100)}%
            </p>
          ) : null}
          {pendingConfirmation ? (
            <p className="text-foreground mt-2 text-xs font-medium">
              До подтверждения кнопка старта использует текущую версию{" "}
              {template.currentVersion}.
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <StartWorkoutButton templateId={template.id} compact />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button asChild size="sm" variant="ghost" className="-ml-2">
            <Link href={`/templates/${template.id}`}>
              <History className="size-4" />
              Сравнить версии
            </Link>
          </Button>
          <ChevronRight className="text-muted-foreground size-4" />
        </div>
      </div>

      {pendingConfirmation ? (
        <div className="border-border bg-muted/25 grid grid-cols-2 gap-2 border-t p-3">
          <form action={confirmTemplateVersionAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <Button type="submit" size="sm" variant="outline" className="w-full">
              <Check className="size-4" />
              Подтвердить
            </Button>
          </form>
          {template.previousVersionId ? (
            <form action={restoreTemplateVersionAction}>
              <input type="hidden" name="templateId" value={template.id} />
              <input
                type="hidden"
                name="versionId"
                value={template.previousVersionId}
              />
              <Button type="submit" size="sm" variant="ghost" className="w-full">
                <RotateCcw className="size-4" />
                Откатить
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
