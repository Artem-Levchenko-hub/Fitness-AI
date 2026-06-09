"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addBodyMeasurementAction,
  type BodyState,
} from "@/server/actions/body";

const initial: BodyState = { status: "idle" };

const FIELDS: Array<{
  name: string;
  label: string;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
}> = [
  { name: "weightKg", label: "Вес", unit: "кг", step: 0.1, min: 20, max: 500 },
  { name: "bodyFatPct", label: "% жира", unit: "%", step: 0.1, min: 1, max: 70 },
  { name: "waistCm", label: "Талия", unit: "см", step: 0.5, min: 30, max: 300 },
  { name: "neckCm", label: "Шея", unit: "см", step: 0.5, min: 20, max: 100 },
  { name: "chestCm", label: "Грудь", unit: "см", step: 0.5, min: 50, max: 200 },
  { name: "hipCm", label: "Бёдра", unit: "см", step: 0.5, min: 30, max: 250 },
  { name: "armCm", label: "Бицепс", unit: "см", step: 0.5, min: 15, max: 80 },
  { name: "thighCm", label: "Бедро", unit: "см", step: 0.5, min: 20, max: 120 },
];

export function BodyMeasurementForm() {
  const [state, formAction, pending] = useActionState<BodyState, FormData>(
    addBodyMeasurementAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="measuredAt">Дата</Label>
        <Input
          id="measuredAt"
          name="measuredAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="h-11"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <Label htmlFor={f.name} className="text-xs">
              {f.label}{" "}
              <span className="text-muted-foreground">({f.unit})</span>
            </Label>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              onFocus={(e) => e.target.select()}
              inputMode="decimal"
              step={f.step}
              min={f.min}
              max={f.max}
              placeholder="—"
              className="tabular h-10"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-xs">
          Заметка (опционально)
        </Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Самочувствие, утром натощак, после еды и т.п."
          className="resize-none"
        />
      </div>

      {state.status === "error" ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="bg-success/10 text-success border-success/20 rounded-md border px-3 py-2 text-sm">
          Замер сохранён
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
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
          "Сохранить замер"
        )}
      </Button>
    </form>
  );
}
