"use client";

import { Check } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  wrapTemplatesAction,
  type ProgramActionState,
} from "@/server/actions/training-programs";

export type WrapTemplateOption = {
  id: string;
  name: string;
  exerciseCount: number;
};

/** Обёртка своих шаблонов в тренировочную систему: имя + выбор шаблонов-дней
 *  в нужном порядке (порядок = порядок выбора). Payload — JSON для серверного
 *  экшена (зеркало TemplateBuilder). */
export function ProgramWrapBuilder({
  templates,
}: {
  templates: WrapTemplateOption[];
}) {
  const [name, setName] = useState("");
  // Порядок выбора = порядок дней программы (источник истины — выбор атлета).
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<
    ProgramActionState,
    FormData
  >(wrapTemplatesAction, { status: "idle" });

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const valid = name.trim().length >= 2 && selected.length >= 1;
  const payload = JSON.stringify({ name: name.trim(), templateIds: selected });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      <div className="space-y-2">
        <label htmlFor="program-name" className="text-sm font-medium">
          Название системы
        </label>
        <Input
          id="program-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например: Мой сплит верх/низ"
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Дни системы</p>
        <p className="text-muted-foreground text-xs">
          Выберите свои шаблоны по порядку — они станут днями программы. Тренер
          будет адаптировать каждый день на месте после прохождения.
        </p>
        {templates.length === 0 ? (
          <p className="text-muted-foreground bg-muted rounded-xl p-4 text-sm">
            Нет силовых шаблонов. Сначала создайте хотя бы один.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((tpl) => {
              const order = selected.indexOf(tpl.id);
              const isOn = order !== -1;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => toggle(tpl.id)}
                    aria-pressed={isOn}
                    className={cn(
                      "border-border flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                      isOn ? "border-primary bg-primary/5" : "bg-card hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {tpl.name}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {tpl.exerciseCount} упр.
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        isOn
                          ? "bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground border",
                      )}
                    >
                      {isOn ? order + 1 : <Check className="size-3 opacity-0" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {state.status === "error" ? (
        <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={!valid || pending}
      >
        {pending ? "Создаём…" : "Собрать систему"}
      </Button>
    </form>
  );
}
