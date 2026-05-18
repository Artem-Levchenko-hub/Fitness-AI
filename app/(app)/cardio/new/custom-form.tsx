"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { startCardioAction } from "@/server/actions/cardio";

/** "Свой формат" — параметрический preset.
 *  Юзер задаёт: число раундов, работа сек, отдых сек.
 *  Идеально для лестницы (4+4 пролёта) и любых нестандартных интервалов. */
export function CustomPresetForm() {
  const [rounds, setRounds] = useState(6);
  const [workSec, setWorkSec] = useState(30);
  const [restSec, setRestSec] = useState(60);

  const total = (workSec + restSec) * rounds - restSec; // последний отдых не считаем

  return (
    <form action={startCardioAction} className="bg-card border-border rounded-2xl border p-5">
      <input type="hidden" name="preset" value="custom" />
      <input
        type="hidden"
        name="name"
        value={`Свой · ${rounds}×${workSec}/${restSec}`}
      />
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Settings2 className="size-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Свой формат</h3>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              Например, для лестницы 4 пролёта прыжки + 4 пролёта шаг — 30/60.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Раундов" value={rounds} onChange={setRounds} min={1} max={60} name="rounds" />
            <Field label="Работа, сек" value={workSec} onChange={setWorkSec} min={5} max={600} name="workSec" />
            <Field label="Отдых, сек" value={restSec} onChange={setRestSec} min={0} max={600} name="restSec" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground tabular text-xs">
              Общее: {formatDuration(total)}
            </p>
            <Button type="submit">Начать</Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  name,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  name: string;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
        {label}
      </span>
      <input
        type="number"
        name={name}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="border-input bg-background tabular mt-1 w-full rounded-md border px-3 py-2 text-base font-medium"
      />
    </label>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m} мин`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
