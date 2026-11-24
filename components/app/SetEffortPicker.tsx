"use client";

import { Check } from "lucide-react";
import { SET_EFFORTS, setEffortLabel, type SetEffort } from "@/lib/domain/workouts/effort";
import { cn } from "@/lib/utils";

export function SetEffortPicker({ value, onChange, disabled }: {
  value: SetEffort | null;
  onChange: (value: SetEffort | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Отметка усилия" className="grid grid-cols-2 gap-3">
      {SET_EFFORTS.map((effort) => (
        <button key={effort} type="button" disabled={disabled} aria-pressed={value === effort}
          onClick={() => onChange(value === effort ? null : effort)}
          className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-50", effort === "near_failure"
            ? value === effort ? "border-orange-500 bg-orange-500 text-white" : "border-orange-500/35 bg-orange-500/5 text-orange-700 dark:text-orange-400"
            : value === effort ? "border-red-600 bg-red-600 text-white" : "border-red-500/35 bg-red-500/5 text-red-700 dark:text-red-400")}>
          <span aria-hidden className="flex size-4 items-center justify-center rounded border border-current">
            <Check className={cn("size-3", value !== effort && "opacity-0")} />
          </span>
          {setEffortLabel(effort)}
        </button>
      ))}
    </div>
  );
}
