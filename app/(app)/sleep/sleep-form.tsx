"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import {
  type SleepActionState,
  upsertSleepAction,
} from "@/server/actions/sleep";

const initial: SleepActionState = { status: "idle" };

export function SleepForm({
  defaultDate,
  defaultHours,
  defaultQuality,
  defaultNotes,
}: {
  defaultDate: string;
  defaultHours: number | null;
  defaultQuality: number | null;
  defaultNotes: string | null;
}) {
  const [state, action, pending] = useActionState(upsertSleepAction, initial);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="date" value={defaultDate} />

      <div>
        <Label htmlFor="hours">Часы сна</Label>
        <NumberField
          id="hours"
          name="hours"
          decimal
          defaultValue={defaultHours != null ? String(defaultHours) : ""}
          placeholder="7.5"
          required
          className="mt-1"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Качество сна (1–5, опционально)</legend>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="bg-card hover:bg-accent border-border has-[:focus-visible]:ring-ring flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border py-2 text-sm font-medium has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="quality"
                value={n}
                defaultChecked={defaultQuality === n}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="notes">Заметка (опционально)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaultNotes ?? ""}
          rows={2}
          maxLength={500}
          placeholder="Просыпался ночью, утром тяжело"
          className="mt-1"
        />
      </div>

      {state.status === "error" ? (
        <p className="text-destructive text-sm" role="alert">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-success text-sm" role="status" aria-live="polite">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending} size="xl" className="w-full">
        {pending ? "Сохраняю…" : "Сохранить"}
      </Button>
    </form>
  );
}
