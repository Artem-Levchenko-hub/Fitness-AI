import { env } from "@/lib/env";

/**
 * Включён ли биллинг (платное списание за coach-сессии).
 * Default — выключен: пока работаем на бесплатных токенах Gemini.
 * Когда подключим платный провайдер — выставим BILLING_ENABLED=true.
 */
export function isBillingEnabled(): boolean {
  return env.BILLING_ENABLED === true;
}
