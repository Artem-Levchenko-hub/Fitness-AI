/** Денежная арифметика и форматирование (рубли ↔ копейки).
 *  Чистый модуль без env/db-импортов → юнит-тестируем.
 *  Env-зависимая цена коуч-разговора живёт в `./pricing`. */

export const TOPUP_PACKAGES = [
  { rub: 330, label: "330 ₽", subtitle: "≈ 5 AI-диалогов" },
  { rub: 660, label: "660 ₽", subtitle: "≈ 10 AI-диалогов" },
  { rub: 1290, label: "1 290 ₽", subtitle: "≈ 19 AI-диалогов" },
  { rub: 2580, label: "2 580 ₽", subtitle: "≈ 39 AI-диалогов" },
] as const;

export const MIN_TOPUP_RUB = 330;
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
