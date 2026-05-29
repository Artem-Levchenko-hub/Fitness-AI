"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <Input
          id="hours"
          name="hours"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          max="24"
          defaultValue={defaultHours ?? ""}
          placeholder="7.5"
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="quality">Качество сна (1–5, опционально)</Label>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="bg-card hover:bg-accent border-border flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-2 text-sm font-medium has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:border-primary"
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
      </div>

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
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-success text-sm">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending} size="xl" className="w-full">
        {pending ? "Сохраняю…" : "Сохранить"}
      </Button>
    </form>
  );
}
