"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { setShareProgramsAction } from "@/server/actions/friends";

/** Тумблер «делиться программами с друзьями». Оптимистично переключает локальное
 *  состояние и зовёт серверный экшен; при ошибке откатывает. role="switch" +
 *  aria-checked (R-39 — клавиатура/скринридер); тап-цель ≥44px (R-41). Не только
 *  цвет (R-41): подпись «Вкл/Выкл» рядом дублирует состояние текстом. */
export function ShareProgramsToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next); // оптимистично
    const formData = new FormData();
    formData.set("enabled", String(next));
    startTransition(async () => {
      try {
        await setShareProgramsAction(formData);
      } catch {
        setEnabled(!next); // откат при сбое
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          enabled ? "text-primary" : "text-muted-foreground",
        )}
      >
        {enabled ? "Вкл" : "Выкл"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Делиться программами с друзьями"
        onClick={toggle}
        disabled={pending}
        className={cn(
          "focus-visible:ring-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
          enabled ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "bg-background block size-5 rounded-full shadow transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
