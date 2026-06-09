"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { sanitizeNumeric } from "@/lib/utils/numeric";

type Props = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange" | "pattern"
> & {
  /** Контролируемое строковое значение (хранится как строка ради чистого ввода). */
  value: string;
  /** Колбэк уже с санитизированным значением. */
  onChange: (value: string) => void;
  /** Дробное (вес/RPE) vs целое (повторы/подходы). */
  decimal?: boolean;
  /** Выделять всё при фокусе — первый тап заменяет дефолт (фикс бага 06/60). */
  selectOnFocus?: boolean;
};

/** Числовое поле с телефонной цифровой клавиатурой (inputMode) и чистым
 *  редактированием. Прячет санитайз + select-on-focus за узким интерфейсом. */
export function NumberField({
  value,
  onChange,
  decimal = false,
  selectOnFocus = true,
  onFocus,
  ...rest
}: Props) {
  return (
    <Input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(sanitizeNumeric(e.target.value, { decimal }))}
      onFocus={(e) => {
        if (selectOnFocus) e.currentTarget.select();
        onFocus?.(e);
      }}
      {...rest}
    />
  );
}
