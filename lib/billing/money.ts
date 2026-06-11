/** Денежная арифметика и форматирование (рубли ↔ копейки).
 *  Чистый модуль без env/db-импортов → юнит-тестируем.
 *  Env-зависимая цена коуч-разговора живёт в `./pricing`. */

export const TOPUP_PACKAGES = [
  { rub: 250, label: "250 ₽", subtitle: "≈ 25 анализов" },
  { rub: 500, label: "500 ₽", subtitle: "≈ 50 анализов" },
  { rub: 1000, label: "1 000 ₽", subtitle: "≈ 100 анализов" },
  { rub: 2000, label: "2 000 ₽", subtitle: "≈ 200 анализов" },
] as const;

export const MIN_TOPUP_RUB = 250;
export const MAX_TOPUP_RUB = 50_000;

export function rubToKopecks(rub: number): number {
  return Math.round(rub * 100);
}

export function kopecksToRub(kopecks: number): number {
  return kopecks / 100;
}

export function formatRub(kopecks: number): string {
  const rub = kopecks / 100;
  return `${rub.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₽`;
}
