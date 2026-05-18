"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

      <div>
        <Label htmlFor="kcal">Калории (ккал)</Label>
        <Input
          id="kcal"
          name="kcal"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          max="10000"
          defaultValue={defaultKcal ?? ""}
          placeholder="2300"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="proteinG">Белки (г)</Label>
          <Input
            id="proteinG"
            name="proteinG"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="1000"
            defaultValue={defaultProtein ?? ""}
            placeholder="180"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="fatG">Жиры (г)</Label>
          <Input
            id="fatG"
            name="fatG"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="1000"
            defaultValue={defaultFat ?? ""}
            placeholder="70"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="carbsG">Углеводы (г)</Label>
          <Input
            id="carbsG"
            name="carbsG"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            max="2000"
            defaultValue={defaultCarbs ?? ""}
            placeholder="250"
            className="mt-1"
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
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-success text-sm">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending} size="lg" className="w-full">
        {pending ? "Сохраняю…" : "Сохранить"}
      </Button>
    </form>
  );
}
