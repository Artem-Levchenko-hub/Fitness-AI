"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2, Zap } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import {
  ExercisePicker,
  type PickerExercise,
} from "@/components/app/ExercisePicker";
import { MyoRepsInfo } from "@/components/templates/MyoRepsInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateActionState } from "@/server/actions/templates";
import type { TemplateFormValues } from "@/server/schemas/templates";
import { cn } from "@/lib/utils";
import { clampNumber } from "@/lib/utils/numeric";

export type BuilderItem = {
  /** Локальный uid (не БД) — для key + dnd-kit. */
  uid: string;
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  /** Миорепсы: 1 активационный (диапазон повторов выше) + мини-сеты. */
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
  notes: string;
};

type Props = {
  exercises: ReadonlyArray<PickerExercise>;
  initial?: {
    name: string;
    description: string;
    items: BuilderItem[];
  };
  initialDefaultMyoReps?: boolean;
  action: (
    prev: TemplateActionState,
    formData: FormData,
  ) => Promise<TemplateActionState>;
  submitLabel?: string;
};

const DEFAULT_ITEM: Omit<BuilderItem, "uid" | "exerciseId"> = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: null,
  targetRestSeconds: 120,
  myoReps: false,
  // Протокол владельца: 3 мини-сета по 30% повторов активации, отдых 30 с.
  myoMiniSets: 3,
  myoMiniReps: 5,
  myoMiniRestSeconds: 30,
  notes: "",
};

/** При включении миорепсов диапазон активационного по умолчанию 12–20 (почти
 *  до отказа) — если атлет оставил обычные 8–12, подсказываем протокольные. */
const MYO_ACTIVATION_MIN = 12;
const MYO_ACTIVATION_MAX = 20;

export function TemplateBuilder({
  exercises,
  initial,
  initialDefaultMyoReps = false,
  action,
  submitLabel = "Сохранить шаблон",
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [items, setItems] = useState<BuilderItem[]>(
    initial?.items ?? [],
  );
  const [defaultMyoReps, setDefaultMyoReps] = useState(
    () =>
      initial?.items.some((item) => item.myoReps) ?? initialDefaultMyoReps,
  );

  const [state, formAction, pending] = useActionState<
    TemplateActionState,
    FormData
  >(action, { status: "idle" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.uid === active.id);
      const newIndex = prev.findIndex((i) => i.uid === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addItem() {
    const myoDefaults = defaultMyoReps
      ? {
          myoReps: true,
          targetRepsMin: MYO_ACTIVATION_MIN,
          targetRepsMax: MYO_ACTIVATION_MAX,
        }
      : {};

    setItems((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        exerciseId: "",
        ...DEFAULT_ITEM,
        ...myoDefaults,
      },
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
    const payload: TemplateFormValues = {
      name: name.trim(),
      description: description.trim() || undefined,
      items: items
        .filter((i) => i.exerciseId)
        .map((i) => ({
          exerciseId: i.exerciseId,
          targetSets: i.targetSets,
          targetRepsMin: i.targetRepsMin,
          targetRepsMax: i.targetRepsMax,
          targetWeightKg: i.targetWeightKg ?? "",
          targetRestSeconds: i.targetRestSeconds,
          myoReps: i.myoReps,
          myoMiniSets: i.myoMiniSets,
          myoMiniReps: i.myoMiniReps,
          myoMiniRestSeconds: i.myoMiniRestSeconds,
          notes: i.notes,
        })),
    };
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  }

  const canSubmit =
    !pending && name.trim().length >= 2 && items.some((i) => i.exerciseId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Название шаблона</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Спина + бицепс A"
          maxLength={80}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание (опционально)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Что характерно для этой тренировки"
          rows={2}
          maxLength={500}
        />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Упражнения ({items.length})
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Выбери режим новых упражнений. Его можно изменить у каждого упражнения.
          </p>
        </div>

        <div className="bg-card border-border mb-4 rounded-2xl border p-4">
          <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
            Режим новых упражнений
          </p>
          <div
            role="group"
            aria-label="Режим новых упражнений"
            className="bg-muted/50 mt-3 grid grid-cols-2 gap-1 rounded-xl p-1"
          >
            <button
              type="button"
              aria-pressed={!defaultMyoReps}
              onClick={() => setDefaultMyoReps(false)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors",
                !defaultMyoReps
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Классические
            </button>
            <button
              type="button"
              aria-pressed={defaultMyoReps}
              onClick={() => setDefaultMyoReps(true)}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors",
                defaultMyoReps
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-4" aria-hidden="true" />
                Myo-reps
              </span>
            </button>
          </div>
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            Myo-reps: один активационный подход и короткие мини-сеты с тем же
            весом. Настройка сохраняется в каждом упражнении шаблона.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-card border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
            Пока ни одного упражнения. Добавьте первое — и можно сохранять.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.uid)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-3">
                {items.map((item, idx) => (
                  <SortableItem
                    key={item.uid}
                    item={item}
                    index={idx}
                    exercises={exercises}
                    onChange={(patch) => updateItem(item.uid, patch)}
                    onRemove={() => removeItem(item.uid)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
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

      {state.status === "error" ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={!canSubmit}
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
    </form>
  );
}

function SortableItem({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uid });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  function setMyoReps(enabled: boolean) {
    const bumpReps =
      enabled && item.targetRepsMin === 8 && item.targetRepsMax === 12
        ? {
            targetRepsMin: MYO_ACTIVATION_MIN,
            targetRepsMax: MYO_ACTIVATION_MAX,
          }
        : {};
    onChange({ myoReps: enabled, ...bumpReps });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border-border rounded-xl border p-3",
        isDragging && "ring-primary/40 shadow-lg ring-2",
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <button
          type="button"
          aria-label="Перетащить"
          className="text-muted-foreground hover:text-foreground touch-none p-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>
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

      <div
        role="group"
        aria-label="Система подходов"
        className="bg-muted/50 mb-3 grid grid-cols-2 gap-1 rounded-xl p-1"
      >
        <button
          type="button"
          aria-pressed={!item.myoReps}
          onClick={() => setMyoReps(false)}
          className={cn(
            "min-h-10 rounded-lg px-3 text-xs font-medium transition-colors",
            !item.myoReps
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Классические
        </button>
        <button
          type="button"
          aria-pressed={item.myoReps}
          onClick={() => setMyoReps(true)}
          className={cn(
            "min-h-10 rounded-lg px-3 text-xs font-medium transition-colors",
            item.myoReps
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Zap className="size-3.5" aria-hidden="true" />
            Myo-reps
          </span>
        </button>
      </div>

      {item.myoReps ? (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-3">
          <p className="text-primary mb-3 inline-flex items-center gap-1.5 text-xs font-semibold">
            <Zap className="size-3.5" aria-hidden="true" />
            Активация + мини-сеты
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <RangeField
              label="Активация"
              min={item.targetRepsMin}
              max={item.targetRepsMax}
              onMinChange={(v) => onChange({ targetRepsMin: v })}
              onMaxChange={(v) => onChange({ targetRepsMax: v })}
            />
            <NumField
              label="Вес (кг)"
              value={item.targetWeightKg}
              decimal
              allowEmpty
              onChange={(v) => onChange({ targetWeightKg: v })}
            />
            <NumField
              label="Мини-сеты"
              value={item.myoMiniSets}
              min={1}
              max={10}
              onChange={(v) => onChange({ myoMiniSets: v ?? 3 })}
            />
            <NumField
              label="Отдых мини"
              value={item.myoMiniRestSeconds}
              min={5}
              max={60}
              onChange={(v) => onChange({ myoMiniRestSeconds: v ?? 30 })}
            />
          </div>
          <p className="text-muted-foreground/80 mt-2 text-[11px] leading-relaxed">
            1 активационный подход ({item.targetRepsMin}–{item.targetRepsMax}{" "}
            повт. почти до отказа) + {item.myoMiniSets} мини по 30% от
            активации с отдыхом {item.myoMiniRestSeconds} с.
            Поле «Подходы» здесь не участвует.
          </p>
          <MyoRepsInfo />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumField
            label="Подходы"
            value={item.targetSets}
            min={1}
            max={20}
            onChange={(v) => onChange({ targetSets: v ?? 1 })}
          />
          <RangeField
            label="Повторения"
            min={item.targetRepsMin}
            max={item.targetRepsMax}
            onMinChange={(v) => onChange({ targetRepsMin: v })}
            onMaxChange={(v) => onChange({ targetRepsMax: v })}
          />
          <NumField
            label="Вес (кг)"
            value={item.targetWeightKg}
            decimal
            allowEmpty
            onChange={(v) => onChange({ targetWeightKg: v })}
          />
          <NumField
            label="Отдых (сек)"
            value={item.targetRestSeconds}
            min={15}
            max={900}
            onChange={(v) => onChange({ targetRestSeconds: v ?? 60 })}
          />
        </div>
      )}
    </li>
  );
}


function NumField({
  label,
  value,
  onChange,
  min,
  max,
  decimal,
  allowEmpty,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  decimal?: boolean;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const fallback = () => (allowEmpty ? null : (min ?? 0));

  return (
    <label className="block">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <NumberField
        decimal={decimal}
        value={text}
        onChange={(str) => {
          setText(str);
          if (str === "" || str === ".") {
            onChange(fallback());
            return;
          }
          onChange(clampNumber(str, min, max) ?? fallback());
        }}
        onBlur={() => {
          const n = clampNumber(text, min, max);
          setText(n == null ? (allowEmpty ? "" : String(min ?? 0)) : String(n));
        }}
        className="tabular mt-1 h-9 text-center"
      />
    </label>
  );
}

function RangeField({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: number;
  max: number;
  onMinChange: (n: number) => void;
  onMaxChange: (n: number) => void;
}) {
  const [minText, setMinText] = useState(String(min));
  const [maxText, setMaxText] = useState(String(max));

  return (
    <label className="block">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1">
        <NumberField
          aria-label={`${label} — минимум`}
          value={minText}
          onChange={(str) => {
            setMinText(str);
            const n = clampNumber(str, 1, 100);
            if (n != null) onMinChange(n);
          }}
          onBlur={() => {
            const n = clampNumber(minText, 1, 100) ?? 1;
            setMinText(String(n));
            onMinChange(n);
          }}
          className="tabular h-9 text-center"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <NumberField
          aria-label={`${label} — максимум`}
          value={maxText}
          onChange={(str) => {
            setMaxText(str);
            const n = clampNumber(str, 1, 100);
            if (n != null) onMaxChange(n);
          }}
          onBlur={() => {
            const n = clampNumber(maxText, 1, 100) ?? 1;
            setMaxText(String(n));
            onMaxChange(n);
          }}
          className="tabular h-9 text-center"
        />
      </div>
    </label>
  );
}
