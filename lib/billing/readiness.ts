import "server-only";

import { env } from "@/lib/env";

export type BillingReadiness = {
  paymentsEnabled: boolean;
  subscriptionsEnabled: boolean;
  mode: "test" | "live";
  paymentMissing: string[];
  subscriptionMissing: string[];
};

/** Один fail-closed источник готовности денежного контура.
 *
 * Наличие API-ключей само по себе недостаточно: нельзя принимать деньги, пока
 * не заданы реквизиты продавца и адрес поддержки для чека/оферты. */
export function getBillingReadiness(): BillingReadiness {
  const paymentMissing: string[] = [];

  if (!env.YOOKASSA_SHOP_ID) paymentMissing.push("YOOKASSA_SHOP_ID");
  if (!env.YOOKASSA_SECRET_KEY) paymentMissing.push("YOOKASSA_SECRET_KEY");
  if (!env.LEGAL_OPERATOR_NAME) paymentMissing.push("LEGAL_OPERATOR_NAME");
  if (!env.LEGAL_OPERATOR_INN) paymentMissing.push("LEGAL_OPERATOR_INN");
  if (!env.LEGAL_OPERATOR_ADDRESS) paymentMissing.push("LEGAL_OPERATOR_ADDRESS");
  if (!env.LEGAL_SUPPORT_EMAIL) paymentMissing.push("LEGAL_SUPPORT_EMAIL");
  if (!env.LEGAL_DOCUMENTS_APPROVED) {
    paymentMissing.push("LEGAL_DOCUMENTS_APPROVED");
  }
  if (env.BILLING_ENABLED !== true) {
    paymentMissing.push("BILLING_ENABLED");
  }

  const subscriptionMissing = [...paymentMissing];
  if (!env.CRON_SECRET) subscriptionMissing.push("CRON_SECRET");
  if (env.SUBSCRIPTION_ENABLED !== true) {
    subscriptionMissing.push("SUBSCRIPTION_ENABLED");
  }

  const paymentsEnabled = paymentMissing.length === 0;

  return {
    paymentsEnabled,
    subscriptionsEnabled:
      subscriptionMissing.length === 0 && paymentsEnabled,
    mode: env.YOOKASSA_MODE,
    paymentMissing,
    subscriptionMissing,
  };
}

export function shouldCheckYookassaWebhookIp(): boolean {
  return (
    env.YOOKASSA_WEBHOOK_IP_CHECK ??
    (env.YOOKASSA_MODE === "live" && env.NODE_ENV === "production")
  );
}
