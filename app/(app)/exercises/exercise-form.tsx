"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { muscleLabel } from "@/components/app/MuscleBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExerciseActionState } from "@/server/actions/exercises";
import { cn } from "@/lib/utils";

type Props = {
  muscleKeys: ReadonlyArray<string>;
  initial?: {
    nameRu: string;
    nameEn: string;
    description: string | null;
    primary: string[];
    secondary: string[];
  };
  action: (
    prev: ExerciseActionState,
    formData: FormData,
  ) => Promise<ExerciseActionState>;
  submitLabel?: string;
};

export function ExerciseForm({
  muscleKeys,
  initial,
  action,
  submitLabel = "Сохранить",
}: Props) {
  const [state, formAction, pending] = useActionState<
    ExerciseActionState,
    FormData
  >(action, { status: "idle" });
  const [primary, setPrimary] = useState<Set<string>>(
    new Set(initial?.primary ?? []),
  );
  const [secondary, setSecondary] = useState<Set<string>>(
    new Set(initial?.secondary ?? []),
  );

  function togglePrimary(key: string) {
    const next = new Set(primary);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      const sec = new Set(secondary);
      sec.delete(key);
      setSecondary(sec);
    }
    setPrimary(next);
  }

  function toggleSecondary(key: string) {
    const next = new Set(secondary);
    if (next.has(key)) next.delete(key);
    else {
      next.add(key);
      const pri = new Set(primary);
      pri.delete(key);
      setPrimary(pri);
    }
    setSecondary(next);
  }

  return (
    <form action={formAction} className="space-y-6">
      {Array.from(primary).map((p) => (
        <input key={`p-${p}`} type="hidden" name="primary" value={p} />
      ))}
      {Array.from(secondary).map((s) => (
        <input key={`s-${s}`} type="hidden" name="secondary" value={s} />
      ))}

      <div className="space-y-2">
        <Label htmlFor="nameRu">Название (рус)</Label>
        <Input
          id="nameRu"
          name="nameRu"
          defaultValue={initial?.nameRu}
          required
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nameEn">Название (англ)</Label>
        <Input
          id="nameEn"
          name="nameEn"
          defaultValue={initial?.nameEn}
          required
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
          maxLength={2000}
          rows={3}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Основные группы мышц</legend>
        <p className="text-muted-foreground text-xs">
          Группа считается primary (полный объём в статистике).
        </p>
        <MuscleGrid
          keys={muscleKeys}
          selected={primary}
          onToggle={togglePrimary}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Вторичные группы мышц
        </legend>
        <p className="text-muted-foreground text-xs">
          Засчитываются как 50% объёма для суммарной статистики.
        </p>
        <MuscleGrid
          keys={muscleKeys}
          selected={secondary}
          onToggle={toggleSecondary}
          disabledKeys={primary}
        />
      </fieldset>

      {state.status === "error" && state.message ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          size="xl"
          className="flex-1"
          disabled={pending || primary.size === 0}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Сохраняем…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

function MuscleGrid({
  keys,
  selected,
  onToggle,
  disabledKeys,
}: {
  keys: ReadonlyArray<string>;
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabledKeys?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {keys.map((key) => {
        const isSelected = selected.has(key);
        const isDisabled = disabledKeys?.has(key) ?? false;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            disabled={isDisabled}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
              "min-h-11",
              isSelected
                ? "bg-primary text-primary-foreground border-transparent"
                : isDisabled
                  ? "bg-muted/40 text-muted-foreground/50 border-border cursor-not-allowed"
                  : "bg-card text-foreground border-border hover:bg-accent",
            )}
            aria-pressed={isSelected}
          >
            {muscleLabel(key)}
          </button>
        );
      })}
    </div>
  );
}
