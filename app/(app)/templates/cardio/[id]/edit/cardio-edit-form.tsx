"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import type { CardioEditInitial } from "@/lib/domain";
import { clampNumber } from "@/lib/utils/numeric";

/** H14.5c — форма редактирования кардио-шаблона. Кардио-«билдера» нет: формат
 *  фиксирован (его пресет не меняется при правке — смена формата = другой
 *  шаблон), редактируются имя и параметры, осмысленные для пресета (custom →
 *  раунды/работа/отдых; emom → раунды; tabata/norwegian → только имя). Поля и
 *  имена инпутов зеркалят /cardio/new (preset + name + параметры), поэтому
 *  updateCardioTemplateAction переиспользует тот же payload-парсер, что save. */
export function CardioEditForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void;
  initial: CardioEditInitial;
}) {
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="preset" value={initial.preset} />

      <label className="block space-y-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Название
        </span>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initial.name}
          required
          maxLength={80}
          className="border-border bg-card focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
        />
      </label>

      {initial.preset === "custom" ? (
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Раундов" name="rounds" initial={initial.rounds} min={1} max={60} />
          <NumField label="Работа, сек" name="workSec" initial={initial.workSec} min={5} max={600} />
          <NumField label="Отдых, сек" name="restSec" initial={initial.restSec} min={0} max={600} />
        </div>
      ) : null}

      {initial.preset === "emom" ? (
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Раундов" name="emomRounds" initial={initial.emomRounds} min={1} max={60} />
        </div>
      ) : null}

      {initial.preset === "tabata" || initial.preset === "norwegian_4x4" ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Формат фиксирован — интервалы заданы пресетом. Изменить можно только
          название.
        </p>
      ) : null}

      <Button type="submit" size="xl" className="w-full">
        Сохранить изменения
      </Button>
    </form>
  );
}

/** number-контракт поверх NumberField + локальное строковое состояние
 *  (зеркало NumberFieldBridge из /cardio/new custom-form). */
function NumField({
  label,
  name,
  initial,
  min,
  max,
}: {
  label: string;
  name: string;
  initial: number;
  min: number;
  max: number;
}) {
  const [text, setText] = useState(String(initial));
  return (
    <label className="block">
      <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
        {label}
      </span>
      <NumberField
        name={name}
        value={text}
        onChange={setText}
        onBlur={() => {
          const n = clampNumber(text, min, max) ?? min;
          setText(String(n));
        }}
        className="tabular mt-1 h-11 w-full text-base font-medium"
      />
    </label>
  );
}
