"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { clampNumber, sanitizeNumeric } from "@/lib/utils/numeric";

type Props = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange" | "pattern" | "defaultValue"
> & {
  /** Контролируемое строковое значение. */
  value?: string;
  /** Старт для неконтролируемого режима (FormData-формы). */
  defaultValue?: string;
  /** Колбэк с уже санитизированным значением. */
  onChange?: (value: string) => void;
  /** Дробное (вес/RPE) vs целое (повторы/кругов). */
  decimal?: boolean;
  /** Выделять всё при фокусе — первый тап заменяет дефолт (фикс 0/06/60). */
  selectOnFocus?: boolean;
};

/** Числовое поле: телефонная цифровая клава (inputMode) + чистое
 *  редактирование (нет залипшего 0, нет ведущих нулей). Работает и
 *  контролируемо (value+onChange), и неконтролируемо (defaultValue + name). */
export function NumberField({
  value,
  defaultValue,
  onChange,
  decimal = false,
  selectOnFocus = true,
  onFocus,
  ...rest
}: Props) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
  const current = isControlled ? value : internal;

  return (
    <Input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      autoComplete="off"
      value={current}
      onChange={(e) => {
        const s = sanitizeNumeric(e.target.value, { decimal });
        if (!isControlled) setInternal(s);
        onChange?.(s);
      }}
      onFocus={(e) => {
        if (selectOnFocus) e.currentTarget.select();
        onFocus?.(e);
      }}
      {...rest}
    />
  );
}

/** Лейбл + NumberField с числовым контрактом (value: number|null).
 *  Локальное строковое состояние ради чистого ввода; наружу — числа.
 *  Заменяет дублирующиеся локальные NumField в билдерах (DRY). */
export function LabeledNumberField({
  label,
  value,
  onChange,
  min,
  max,
  decimal = false,
  allowEmpty = false,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  decimal?: boolean;
  allowEmpty?: boolean;
  className?: string;
}) {
  const [text, setText] = React.useState(value == null ? "" : String(value));
  const fallback = () => (allowEmpty ? null : (min ?? 0));

  return (
    <label className="block">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <NumberField
        decimal={decimal}
        value={text}
        onChange={(str) => {
          setText(str);
          if (str === "" || str === ".") {
            onChange(fallback());
            return;
          }
          onChange(clampNumber(str, min, max) ?? fallback());
        }}
        onBlur={() => {
          const n = clampNumber(text, min, max);
          setText(n == null ? (allowEmpty ? "" : String(min ?? 0)) : String(n));
        }}
        className={className ?? "tabular mt-1 h-9 text-center"}
      />
    </label>
  );
}
