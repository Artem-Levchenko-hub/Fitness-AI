import { CheckCircle2, GitCompareArrows, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TemplateVersionListItem } from "@/lib/repos/template-versions.repo";
import { restoreTemplateVersionAction } from "@/server/actions/templates";

export function TemplateVersionHistory({
  templateId,
  versions,
  currentVersion,
}: {
  templateId: string;
  versions: TemplateVersionListItem[];
  currentVersion: number;
}) {
  if (versions.length === 0) return null;

  const [current, previous] = versions;
  const changes =
    current && previous
      ? compareSnapshots(previous.snapshot, current.snapshot)
      : [];

  return (
    <section className="border-border bg-card mt-6 rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="text-primary size-4" aria-hidden="true" />
        <h2 className="text-sm font-semibold">История версий</h2>
      </div>

      {current && previous ? (
        <div className="bg-muted/40 mt-4 rounded-xl p-3">
          <p className="text-xs font-semibold">
            Версия {previous.versionNumber} → {current.versionNumber}
          </p>
          {changes.length > 0 ? (
            <ul className="text-muted-foreground mt-2 space-y-1 text-xs leading-relaxed">
              {changes.slice(0, 6).map((change) => (
                <li key={change}>• {change}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              Параметры упражнений совпадают.
            </p>
          )}
        </div>
      ) : null}

      <ol className="mt-4 space-y-3">
        {versions.map((version, index) => (
          <li
            key={version.id}
            className="border-border flex items-start justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  Версия {version.versionNumber}
                </p>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase">
                  {sourceLabel(version.source)}
                </span>
                {version.versionNumber === currentVersion ? (
                  <span className="text-primary inline-flex items-center gap-1 text-[10px] font-medium uppercase">
                    <CheckCircle2 className="size-3" />
                    активна
                  </span>
                ) : version.requiresConfirmation && version.confirmedAt == null ? (
                  <span className="text-amber-700 inline-flex items-center gap-1 text-[10px] font-medium uppercase">
                    ждёт подтверждения
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-medium">{version.summary}</p>
              {version.rationale ? (
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {version.rationale}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-[10px]">
                {version.createdAt.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {version.confidence != null
                  ? ` · уверенность ${Math.round(version.confidence * 100)}%`
                  : ""}
              </p>
            </div>
            {index > 0 ? (
              <form action={restoreTemplateVersionAction} className="shrink-0">
                <input type="hidden" name="templateId" value={templateId} />
                <input type="hidden" name="versionId" value={version.id} />
                <Button type="submit" size="sm" variant="ghost">
                  <RotateCcw className="size-4" />
                  Вернуть
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function sourceLabel(source: TemplateVersionListItem["source"]): string {
  if (source === "trainer") return "тренер";
  if (source === "rollback") return "откат";
  return "вручную";
}

function compareSnapshots(
  before: TemplateVersionListItem["snapshot"],
  after: TemplateVersionListItem["snapshot"],
): string[] {
  const changes: string[] = [];
  const max = Math.max(before.length, after.length);
  for (let index = 0; index < max; index += 1) {
    const prev = before[index];
    const next = after[index];
    const position = index + 1;
    if (!prev && next) {
      changes.push(`Позиция ${position}: добавлено упражнение`);
      continue;
    }
    if (prev && !next) {
      changes.push(`Позиция ${position}: упражнение удалено`);
      continue;
    }
    if (!prev || !next) continue;
    if (prev.exerciseId !== next.exerciseId) {
      changes.push(`Позиция ${position}: упражнение заменено`);
      continue;
    }
    const prevPlan = planLabel(prev);
    const nextPlan = planLabel(next);
    if (prevPlan !== nextPlan) {
      changes.push(`Позиция ${position}: ${prevPlan} → ${nextPlan}`);
    }
  }
  return changes;
}

function planLabel(item: TemplateVersionListItem["snapshot"][number]): string {
  if (item.setScheme === "myo_reps") {
    return `Myo-reps ${item.targetRepsMin}–${item.targetRepsMax}, ${item.myoMiniSets ?? 3} мини, отдых ${item.myoFirstRestSeconds ?? 40}/${item.myoRestSeconds ?? 30}с`;
  }
  const weight =
    item.targetWeightKg != null ? `, ${item.targetWeightKg} кг` : "";
  return `${item.targetSets}×${item.targetRepsMin}–${item.targetRepsMax}${weight}, отдых ${item.targetRestSeconds}с`;
}
