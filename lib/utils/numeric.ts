/** Чистая логика числового ввода для NumberField.
 *  Главное — убирает баг ведущего нуля (`06` → `6`, `60` остаётся `60`)
 *  и нелегальные символы, оставляя строку, удобную для controlled-инпута. */
export function sanitizeNumeric(
  raw: string,
  opts: { decimal?: boolean } = {},
): string {
  const decimal = opts.decimal ?? false;
  if (raw === "") return "";

  // Только цифры (+ одна точка в decimal-режиме; запятую трактуем как точку).
  let cleaned = decimal
    ? raw.replace(/,/g, ".").replace(/[^0-9.]/g, "")
    : raw.replace(/[^0-9]/g, "");

  if (decimal) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
  }

  // Срезаем ведущие нули: "06" → "6", "007" → "7". Но одиночный "0"
  // и ноль перед точкой ("0.5") сохраняем.
  cleaned = cleaned.replace(/^0+(?=\d)/, "");

  return cleaned;
}

/** Парсит санитизированную строку в число и зажимает в [min, max].
 *  Пусто/`.`/NaN → null. */
export function clampNumber(
  value: string,
  min?: number,
  max?: number,
): number | null {
  if (value === "" || value === ".") return null;
  let n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}
