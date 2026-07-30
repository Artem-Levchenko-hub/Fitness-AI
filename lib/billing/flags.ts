import "server-only";

import { getBillingReadiness } from "@/lib/billing/readiness";

/**
 * Включён ли биллинг (платное списание за coach-сессии).
 * Default — выключен: пока работаем на бесплатных токенах Gemini.
 * Когда подключим платный провайдер — выставим BILLING_ENABLED=true.
 */
export function isBillingEnabled(): boolean {
  return getBillingReadiness().paymentsEnabled;
}

export function isSubscriptionEnabled(): boolean {
  return getBillingReadiness().subscriptionsEnabled;
}
