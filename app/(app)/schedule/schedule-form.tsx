"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEEKDAYS } from "@/lib/ui/weekdays";
import {
  createScheduleAction,
  type ScheduleState,
} from "@/server/actions/schedule";

const initial: ScheduleState = { status: "idle" };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Опция пикера заготовки: value = "kind:id", label = имя заготовки. */
export type PresetOption = { value: string; label: string };

export type ScheduleFormProps = {
  presetGroups: {
    templates: PresetOption[];
    circuits: PresetOption[];
    cardio: PresetOption[];
  };
};

export function ScheduleForm({ presetGroups }: ScheduleFormProps) {
  const [state, formAction, pending] = useActionState<ScheduleState, FormData>(
    createScheduleAction,
    initial,
  );

  const { templates, circuits, cardio } = presetGroups;
  const hasPresets =
    templates.length > 0 || circuits.length > 0 || cardio.length > 0;

  return (
    <form action={formAction} className="space-y-5" key={state.status === "success" ? "reset" : "form"}>
      <div className="space-y-2">
        <Label htmlFor="label">Что тренировать</Label>
        <input
          id="label"
          name="label"
          type="text"
          required
          maxLength={60}
          placeholder="напр. Ноги · Грудь + трицепс"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Дни недели</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WEEKDAYS.map((d) => (
            <label
              key={d.iso}
              className="border-border bg-card text-card-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary flex min-h-14 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors select-none"
            >
              <input
                type="checkbox"
                name="days"
                value={d.iso}
                className="sr-only"
              />
              <span aria-label={d.full}>{d.short}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label>Во сколько напомнить</Label>
        <Select name="hour" defaultValue="18">
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}:00
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground/70 text-xs">
          По вашему часовому поясу из профиля.
        </p>
      </div>

      {hasPresets ? (
        <div className="space-y-2">
          <Label htmlFor="preset">Какую тренировку делать (необязательно)</Label>
          <select
            id="preset"
            name="preset"
            defaultValue=""
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Свободное — выбрать при старте</option>
            {templates.length > 0 ? (
              <optgroup label="Силовые шаблоны">
                {templates.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {circuits.length > 0 ? (
              <optgroup label="Круговые">
                {circuits.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {cardio.length > 0 ? (
              <optgroup label="Кардио">
                {cardio.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <p className="text-muted-foreground/70 text-xs">
            Привяжите конкретную заготовку — и в нужный день увидите «сегодня
            надо вот эту».
          </p>
        </div>
      ) : null}

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
          Расписание добавлено
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
          "Добавить расписание"
        )}
      </Button>
    </form>
  );
}
