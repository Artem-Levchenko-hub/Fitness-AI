"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { clampNumber } from "@/lib/utils/numeric";
import { startCardioAction } from "@/server/actions/cardio";
import { saveCardioTemplateAction } from "@/server/actions/cardio-templates";

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
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Свой формат</h3>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              Например, для лестницы 4 пролёта прыжки + 4 пролёта шаг — 30/60.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Раундов" value={rounds} onChange={setRounds} min={1} max={60} name="rounds" />
            <Field label="Работа, сек" value={workSec} onChange={setWorkSec} min={5} max={600} name="workSec" />
            <Field label="Отдых, сек" value={restSec} onChange={setRestSec} min={0} max={600} name="restSec" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground tabular text-xs">
              Общее: {formatDuration(total)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" className="min-h-11">
                Начать
              </Button>
              {/* H14.3: тот же FormData (preset+name+rounds/workSec/restSec) —
                  formAction переключает старт на сохранение шаблона. */}
              <Button
                type="submit"
                formAction={saveCardioTemplateAction}
                variant="outline"
                className="min-h-11"
              >
                Сохранить как шаблон
              </Button>
            </div>
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
      <NumberFieldBridge value={value} min={min} max={max} name={name} onChange={onChange} />
    </label>
  );
}

/** number-контракт поверх NumberField + локальное строковое состояние. */
function NumberFieldBridge({
  value,
  min,
  max,
  name,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  name: string;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <NumberField
      name={name}
      value={text}
      onChange={(str) => {
        setText(str);
        const n = clampNumber(str, min, max);
        onChange(n ?? min);
      }}
      onBlur={() => {
        const n = clampNumber(text, min, max) ?? min;
        setText(String(n));
        onChange(n);
      }}
      className="tabular mt-1 h-11 w-full text-base font-medium"
    />
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m} мин`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
