"use client";

import { ChevronDown, Loader2, Trash2, Trophy } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import type { StrengthRecord } from "@/db/schema/strength-records";
import {
  formatStrengthValue,
  STRENGTH_MOVEMENT_DEFINITIONS,
  type StrengthRecordSummary,
} from "@/lib/domain/strength-records";
import {
  addStrengthRecordAction,
  deleteStrengthRecordAction,
  type StrengthRecordState,
} from "@/server/actions/strength-records";

const initialState: StrengthRecordState = { status: "idle" };

export function StrengthRecordsList({
  summaries,
  today,
}: {
  summaries: Record<
    (typeof STRENGTH_MOVEMENT_DEFINITIONS)[number]["key"],
    StrengthRecordSummary
  >;
  today: string;
}) {
  return (
    <div className="space-y-3">
      {STRENGTH_MOVEMENT_DEFINITIONS.map((movement) => (
        <RecordCard
          key={movement.key}
          movement={movement}
          summary={summaries[movement.key]}
          today={today}
        />
      ))}
    </div>
  );
}

function RecordCard({
  movement,
  summary,
  today,
}: {
  movement: (typeof STRENGTH_MOVEMENT_DEFINITIONS)[number];
  summary: StrengthRecordSummary;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<
    StrengthRecordState,
    FormData
  >(addStrengthRecordAction, initialState);
  const best = summary.personalBest;
  const latest = summary.latest;

  return (
    <details className="group bg-card border-border overflow-hidden rounded-3xl border">
      <summary className="focus-visible:ring-ring flex min-h-24 cursor-pointer list-none items-center gap-4 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
          <Trophy className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">
            {movement.title}
          </span>
          <span className="text-muted-foreground mt-1 block text-xs">
            {latest
              ? `Последний: ${formatStrengthValue(latest.value)} ${movement.unit}`
              : "Нажмите, чтобы добавить результат"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="text-muted-foreground block text-[10px] font-medium tracking-wide uppercase">
            Рекорд
          </span>
          <span className="tabular block text-xl font-semibold">
            {best ? `${formatStrengthValue(best.value)} ${movement.unit}` : "—"}
          </span>
        </span>
        <ChevronDown
          className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="border-border border-t px-5 py-5">
        <p className="bg-muted/60 text-muted-foreground rounded-2xl px-4 py-3 text-sm leading-relaxed">
          <span className="text-foreground font-medium">Стандарт: </span>
          {movement.description}
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="movement" value={movement.key} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${movement.key}-value`}>
                {movement.inputLabel}, {movement.unit}
              </Label>
              <NumberField
                id={`${movement.key}-value`}
                name="value"
                decimal={movement.decimal}
                placeholder={movement.inputHint}
                required
                className="tabular h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${movement.key}-date`}>Дата</Label>
              <Input
                id={`${movement.key}-date`}
                name="performedAt"
                type="date"
                defaultValue={today}
                max={today}
                required
                className="h-12"
              />
            </div>
          </div>

          {state.status === "error" ? (
            <p
              className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl border px-3 py-2 text-sm"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p
              className="bg-success/10 text-success border-success/20 rounded-xl border px-3 py-2 text-sm"
              role="status"
            >
              Результат сохранён
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Сохраняем…
              </>
            ) : (
              "Сохранить результат"
            )}
          </Button>
        </form>

        {summary.history.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold">История</h2>
            <ul className="mt-2 divide-y">
              {visibleHistory(summary).map((record) => (
                <HistoryRow
                  key={record.id}
                  record={record}
                  unit={movement.unit}
                  isBest={record.id === summary.personalBest?.id}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function HistoryRow({
  record,
  unit,
  isBest,
}: {
  record: StrengthRecord;
  unit: "повт." | "кг";
  isBest: boolean;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2">
      <span className="tabular flex-1 font-medium">
        {formatStrengthValue(record.value)} {unit}
      </span>
      {isBest ? (
        <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-[10px] font-semibold uppercase">
          Рекорд
        </span>
      ) : null}
      <time
        dateTime={record.performedAt}
        className="text-muted-foreground text-sm"
      >
        {formatDate(record.performedAt)}
      </time>
      <form
        action={deleteStrengthRecordAction}
        onSubmit={(event) => {
          if (!window.confirm("Удалить этот результат?")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={record.id} />
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Удалить результат за ${formatDate(record.performedAt)}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </form>
    </li>
  );
}

function visibleHistory(summary: StrengthRecordSummary): StrengthRecord[] {
  const recent = summary.history.slice(0, 10);
  const best = summary.personalBest;
  if (best && !recent.some((record) => record.id === best.id)) {
    recent.push(best);
  }
  return recent;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
