"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { startTransition, useState } from "react";

import {
  ExercisePicker,
  type PickerExercise,
} from "@/components/app/ExercisePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabeledNumberField } from "@/components/ui/number-field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { startCircuitAction } from "@/server/actions/circuits";

type BuilderItem = {
  uid: string;
  exerciseId: string;
  kind: "reps" | "duration";
  targetReps: number;
  targetDurationSec: number;
  targetWeightKg: number | null;
  notes: string;
};

const DEFAULT_ITEM: Omit<BuilderItem, "uid" | "exerciseId"> = {
  kind: "reps",
  targetReps: 12,
  targetDurationSec: 40,
  targetWeightKg: null,
  notes: "",
};

export function CircuitBuilder({
  exercises,
}: {
  exercises: ReadonlyArray<PickerExercise>;
}) {
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState(3);
  const [restBetweenRoundsSec, setRestBetweenRoundsSec] = useState(60);
  const [restBetweenExercisesSec, setRestBetweenExercisesSec] = useState(15);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), exerciseId: "", ...DEFAULT_ITEM },
    ]);
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  }

  function updateItem(uid: string, patch: Partial<BuilderItem>) {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((i) => i.exerciseId);
    if (validItems.length === 0) {
      setError("Добавь хотя бы одно упражнение с выбранным каталожным позицием.");
      return;
    }
    for (const it of validItems) {
      if (it.kind === "reps" && (!Number.isFinite(it.targetReps) || it.targetReps <= 0)) {
        setError("Для упражнений с повторениями укажи число повторений > 0.");
        return;
      }
      if (
        it.kind === "duration" &&
        (!Number.isFinite(it.targetDurationSec) || it.targetDurationSec <= 0)
      ) {
        setError("Для упражнений на время укажи длительность > 0 сек.");
        return;
      }
    }

    const payload = {
      name: name.trim(),
      totalRounds,
      restBetweenRoundsSec,
      restBetweenExercisesSec,
      exercises: validItems.map((i) => ({
        exerciseId: i.exerciseId,
        kind: i.kind,
        targetReps: i.kind === "reps" ? i.targetReps : null,
        targetDurationSec: i.kind === "duration" ? i.targetDurationSec : null,
        targetWeightKg: i.targetWeightKg ?? null,
        notes: i.notes || null,
      })),
    };

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));

    setSubmitting(true);
    startTransition(async () => {
      try {
        await startCircuitAction(fd);
      } catch (err) {
        // redirect() в server action бросает специальное исключение —
        // не считаем это ошибкой UX.
        if (err && typeof err === "object" && "digest" in err) {
          // NEXT_REDIRECT — нормально, страница уже редиректит.
          return;
        }
        const msg = err instanceof Error ? err.message : "Не удалось создать";
        setError(msg);
        setSubmitting(false);
      }
    });
  }

  const canSubmit =
    !submitting && name.trim().length >= 2 && items.some((i) => i.exerciseId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
          placeholder="Например: Full body circuit"
          maxLength={80}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField
          label="Кругов"
          value={totalRounds}
          min={1}
          max={30}
          onChange={(v) => setTotalRounds(v ?? 1)}
        />
        <NumField
          label="Отдых между упр. (сек)"
          value={restBetweenExercisesSec}
          min={0}
          max={600}
          step={5}
          onChange={(v) => setRestBetweenExercisesSec(v ?? 0)}
        />
        <NumField
          label="Отдых между кругами (сек)"
          value={restBetweenRoundsSec}
          min={0}
          max={1800}
          step={15}
          onChange={(v) => setRestBetweenRoundsSec(v ?? 0)}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">
            Упражнения ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="bg-card border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
            Пока пусто. Добавь упражнение — выбери из каталога и задай повторения
            или длительность.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, idx) => (
              <ItemRow
                key={item.uid}
                item={item}
                index={idx}
                exercises={exercises}
                onChange={(patch) => updateItem(item.uid, patch)}
                onRemove={() => removeItem(item.uid)}
              />
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          className="mt-3 w-full"
          size="lg"
        >
          <Plus className="size-5" />
          Добавить упражнение
        </Button>
      </div>

      {error ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={!canSubmit}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Запускаем…
          </>
        ) : (
          "Создать и начать круговую"
        )}
      </Button>
    </form>
  );
}

function ItemRow({
  item,
  index,
  exercises,
  onChange,
  onRemove,
}: {
  item: BuilderItem;
  index: number;
  exercises: ReadonlyArray<PickerExercise>;
  onChange: (patch: Partial<BuilderItem>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="bg-card border-border rounded-xl border p-3">
      <div className="mb-3 flex items-start gap-2">
        <span className="text-muted-foreground bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <ExercisePicker
            exercises={exercises}
            value={item.exerciseId || null}
            onChange={(id) => onChange({ exerciseId: id })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Удалить упражнение"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <KindToggle
          value={item.kind}
          onChange={(kind) => onChange({ kind })}
        />
        <NumField
          label="Вес (кг, опц.)"
          value={item.targetWeightKg}
          step={2.5}
          allowEmpty
          onChange={(v) => onChange({ targetWeightKg: v })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {item.kind === "reps" ? (
          <NumField
            label="Повторения"
            value={item.targetReps}
            min={1}
            max={500}
            onChange={(v) => onChange({ targetReps: v ?? 1 })}
          />
        ) : (
          <NumField
            label="Длительность (сек)"
            value={item.targetDurationSec}
            min={1}
            max={3600}
            step={5}
            onChange={(v) => onChange({ targetDurationSec: v ?? 1 })}
          />
        )}
        <label className="block">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Заметка (опц.)
          </span>
          <Textarea
            value={item.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={1}
            maxLength={300}
            placeholder="Что важно по технике"
            className="tabular mt-1 min-h-[36px]"
          />
        </label>
      </div>
    </li>
  );
}

function KindToggle({
  value,
  onChange,
}: {
  value: "reps" | "duration";
  onChange: (v: "reps" | "duration") => void;
}) {
  return (
    <div className="block">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Формат
      </span>
      <div className="bg-muted text-muted-foreground mt-1 grid h-9 grid-cols-2 rounded-md p-0.5 text-sm">
        <button
          type="button"
          onClick={() => onChange("reps")}
          className={cn(
            "rounded transition-colors",
            value === "reps"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          Повторения
        </button>
        <button
          type="button"
          onClick={() => onChange("duration")}
          className={cn(
            "rounded transition-colors",
            value === "duration"
              ? "bg-background text-foreground shadow-sm"
              : "hover:text-foreground",
          )}
        >
          На время
        </button>
      </div>
    </div>
  );
}

/** Тонкая обёртка над общим LabeledNumberField — сохраняет прежний интерфейс
 *  вызовов (включая необязательный step, который теперь не нужен). */
function NumField(props: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowEmpty?: boolean;
}) {
  return (
    <LabeledNumberField
      label={props.label}
      value={props.value}
      onChange={props.onChange}
      min={props.min}
      max={props.max}
      allowEmpty={props.allowEmpty}
      decimal
    />
  );
}
