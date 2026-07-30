import { env } from "@/lib/env";

// Чистая денежная арифметика/форматирование вынесена в env-free `./money`
// (юнит-тестируема). Реэкспорт сохраняет публичный API `@/lib/billing/pricing`.
export {
  TOPUP_PACKAGES,
  MIN_TOPUP_RUB,
  MAX_TOPUP_RUB,
  rubToKopecks,
  kopecksToRub,
  formatRub,
} from "./money";

/** Цена одного ответа AI-тренера в копейках. Default 2200 (22 ₽).
 *  Меняется через AI_COACH_PRICE_KOPECKS в .env.production. */
export function aiCoachPriceKopecks(): number {
  return env.AI_COACH_PRICE_KOPECKS ?? 2200;
}
