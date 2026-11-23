"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import {
  type NutritionActionState,
  upsertNutritionAction,
} from "@/server/actions/nutrition";

const initial: NutritionActionState = { status: "idle" };

export function NutritionForm({
  defaultDate,
  defaultKcal,
  defaultProtein,
  defaultFat,
  defaultCarbs,
  defaultNotes,
}: {
  defaultDate: string;
  defaultKcal: number | null;
  defaultProtein: number | null;
  defaultFat: number | null;
  defaultCarbs: number | null;
  defaultNotes: string | null;
}) {
  const [state, action, pending] = useActionState(
    upsertNutritionAction,
    initial,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="date" value={defaultDate} />

      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <div>
          <Label htmlFor="kcal">Калории (ккал)</Label>
          <NumberField
            id="kcal"
            name="kcal"
            defaultValue={defaultKcal != null ? String(defaultKcal) : ""}
            placeholder="2300"
            className="mt-2 h-12"
          />
        </div>
        <div>
          <Label htmlFor="proteinG">Белки (г)</Label>
          <NumberField
            id="proteinG"
            name="proteinG"
            decimal
            defaultValue={defaultProtein != null ? String(defaultProtein) : ""}
            placeholder="180"
            className="mt-2 h-12"
          />
        </div>
        <div>
          <Label htmlFor="fatG">Жиры (г)</Label>
          <NumberField
            id="fatG"
            name="fatG"
            decimal
            defaultValue={defaultFat != null ? String(defaultFat) : ""}
            placeholder="70"
            className="mt-2 h-12"
          />
        </div>
        <div>
          <Label htmlFor="carbsG">Углеводы (г)</Label>
          <NumberField
            id="carbsG"
            name="carbsG"
            decimal
            defaultValue={defaultCarbs != null ? String(defaultCarbs) : ""}
            placeholder="250"
            className="mt-2 h-12"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Заметка (опционально)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaultNotes ?? ""}
          rows={2}
          maxLength={500}
          placeholder="Сегодня в дефиците"
          className="mt-1"
        />
      </div>

      {state.status === "error" ? (
        <p role="alert" className="bg-destructive/10 text-destructive border-destructive/20 rounded-xl border px-3 py-3 text-sm">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" aria-live="polite" className="bg-success/10 text-success border-success/20 rounded-xl border px-3 py-3 text-sm">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending} aria-busy={pending} size="xl" className="w-full">
        {pending ? "Сохраняю…" : "Сохранить"}
      </Button>
    </form>
  );
}
