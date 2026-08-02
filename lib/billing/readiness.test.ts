import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockedEnv } = vi.hoisted(() => ({
  mockedEnv: {
    YOOKASSA_SHOP_ID: "test-shop" as string | undefined,
    YOOKASSA_SECRET_KEY: "test-secret" as string | undefined,
    YOOKASSA_MODE: "test" as "test" | "live",
    YOOKASSA_WEBHOOK_IP_CHECK: undefined as boolean | undefined,
    LEGAL_OPERATOR_NAME: "ИП Тест" as string | undefined,
    LEGAL_OPERATOR_INN: "123456789012" as string | undefined,
    LEGAL_OPERATOR_ADDRESS: "Москва" as string | undefined,
    LEGAL_SUPPORT_EMAIL: "support@example.com" as string | undefined,
    LEGAL_DOCUMENTS_APPROVED: true,
    BILLING_ENABLED: true,
    SUBSCRIPTION_ENABLED: true,
    YOOKASSA_RECURRING_ENABLED: true,
    CRON_SECRET: "0123456789abcdef" as string | undefined,
    NODE_ENV: "production" as "development" | "test" | "production",
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: mockedEnv }));

import {
  getBillingReadiness,
  shouldCheckYookassaWebhookIp,
} from "./readiness";

describe("billing readiness", () => {
  beforeEach(() => {
    Object.assign(mockedEnv, {
      YOOKASSA_SHOP_ID: "test-shop",
      YOOKASSA_SECRET_KEY: "test-secret",
      YOOKASSA_MODE: "test",
      YOOKASSA_WEBHOOK_IP_CHECK: undefined,
      LEGAL_OPERATOR_NAME: "ИП Тест",
      LEGAL_OPERATOR_INN: "123456789012",
      LEGAL_OPERATOR_ADDRESS: "Москва",
      LEGAL_SUPPORT_EMAIL: "support@example.com",
      LEGAL_DOCUMENTS_APPROVED: true,
      BILLING_ENABLED: true,
      SUBSCRIPTION_ENABLED: true,
      YOOKASSA_RECURRING_ENABLED: true,
      CRON_SECRET: "0123456789abcdef",
      NODE_ENV: "production",
    });
  });

  it("enables test payments and subscriptions only when all safeguards exist", () => {
    expect(getBillingReadiness()).toEqual({
      paymentsEnabled: true,
      subscriptionsEnabled: true,
      recurringPaymentsEnabled: true,
      mode: "test",
      paymentMissing: [],
      subscriptionMissing: [],
    });
  });

  it("allows top-ups but keeps subscriptions closed without the cron secret", () => {
    mockedEnv.CRON_SECRET = undefined;

    expect(getBillingReadiness()).toMatchObject({
      paymentsEnabled: true,
      subscriptionsEnabled: false,
      recurringPaymentsEnabled: false,
      paymentMissing: [],
      subscriptionMissing: ["CRON_SECRET"],
    });
  });

  it("fails closed when legal approval or provider credentials are absent", () => {
    mockedEnv.YOOKASSA_SECRET_KEY = undefined;
    mockedEnv.LEGAL_DOCUMENTS_APPROVED = false;

    const readiness = getBillingReadiness();
    expect(readiness.paymentsEnabled).toBe(false);
    expect(readiness.subscriptionsEnabled).toBe(false);
    expect(readiness.recurringPaymentsEnabled).toBe(false);
    expect(readiness.paymentMissing).toEqual(
      expect.arrayContaining([
        "YOOKASSA_SECRET_KEY",
        "LEGAL_DOCUMENTS_APPROVED",
      ]),
    );
  });

  it("reports disabled payment and subscription feature flags explicitly", () => {
    mockedEnv.BILLING_ENABLED = false;
    mockedEnv.SUBSCRIPTION_ENABLED = false;

    expect(getBillingReadiness()).toMatchObject({
      paymentsEnabled: false,
      subscriptionsEnabled: false,
      recurringPaymentsEnabled: false,
      paymentMissing: ["BILLING_ENABLED"],
      subscriptionMissing: ["BILLING_ENABLED", "SUBSCRIPTION_ENABLED"],
    });
  });

  it("keeps one-time subscriptions open when recurring payments are unavailable", () => {
    mockedEnv.YOOKASSA_RECURRING_ENABLED = false;

    expect(getBillingReadiness()).toMatchObject({
      paymentsEnabled: true,
      subscriptionsEnabled: true,
      recurringPaymentsEnabled: false,
    });
  });

  it("checks webhook IPs by default only for live production", () => {
    expect(shouldCheckYookassaWebhookIp()).toBe(false);

    mockedEnv.YOOKASSA_MODE = "live";
    expect(shouldCheckYookassaWebhookIp()).toBe(true);

    mockedEnv.YOOKASSA_WEBHOOK_IP_CHECK = false;
    expect(shouldCheckYookassaWebhookIp()).toBe(false);
  });
});
