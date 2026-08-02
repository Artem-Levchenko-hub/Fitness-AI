import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class SubscriptionPaymentInFlightError extends Error {}
  class PaymentIdempotencyConflictError extends Error {}
  class YookassaApiError extends Error {}

  return {
    SubscriptionPaymentInFlightError,
    PaymentIdempotencyConflictError,
    YookassaApiError,
    attachProviderPayment: vi.fn(),
    countRecentPaymentIntents: vi.fn(),
    createYooPayment: vi.fn(),
    getBillingReadiness: vi.fn(),
    getInitialSubscriptionPaymentInFlightForUser: vi.fn(),
    getOrCreatePaymentRecord: vi.fn(),
    getSubscriptionForUser: vi.fn(),
    markPaymentFailed: vi.fn(),
    requireUser: vi.fn(),
  };
});

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/billing/readiness", () => ({
  getBillingReadiness: mocks.getBillingReadiness,
}));
vi.mock("@/lib/billing/yookassa", () => ({
  createYooPayment: mocks.createYooPayment,
  isYookassaPaymentInConfiguredMode: vi.fn(() => true),
  YookassaApiError: mocks.YookassaApiError,
}));
vi.mock("@/lib/env", () => ({
  env: {
    LEGAL_OFFER_VERSION: "test-version",
    NEXT_PUBLIC_APP_URL: "https://fitnesss.online",
  },
}));
vi.mock("@/lib/repos/payments.repo", () => ({
  attachProviderPayment: mocks.attachProviderPayment,
  countRecentPaymentIntents: mocks.countRecentPaymentIntents,
  getInitialSubscriptionPaymentInFlightForUser:
    mocks.getInitialSubscriptionPaymentInFlightForUser,
  getOrCreatePaymentRecord: mocks.getOrCreatePaymentRecord,
  markPaymentFailed: mocks.markPaymentFailed,
  PaymentIdempotencyConflictError: mocks.PaymentIdempotencyConflictError,
  SubscriptionPaymentInFlightError: mocks.SubscriptionPaymentInFlightError,
}));
vi.mock("@/lib/repos/subscriptions.repo", () => ({
  getSubscriptionForUser: mocks.getSubscriptionForUser,
}));

import { POST } from "./route";

const checkoutUrl =
  "https://yoomoney.ru/checkout/payments/v2/contract?orderId=safe";

function request(planCode = "pro_monthly") {
  return new Request(
    "https://fitnesss.online/api/yookassa/subscription/checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planCode,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        paymentMode: "one_time",
        acceptTerms: true,
      }),
    },
  );
}

describe("subscription checkout resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: "user-test",
      email: "user@example.test",
    });
    mocks.getBillingReadiness.mockReturnValue({
      paymentsEnabled: true,
      subscriptionsEnabled: true,
      recurringPaymentsEnabled: false,
      mode: "live",
      paymentMissing: [],
      subscriptionMissing: [],
    });
    mocks.getSubscriptionForUser.mockResolvedValue(null);
    mocks.countRecentPaymentIntents.mockResolvedValue(1);
    mocks.getOrCreatePaymentRecord.mockRejectedValue(
      new mocks.SubscriptionPaymentInFlightError(),
    );
    mocks.getInitialSubscriptionPaymentInFlightForUser.mockResolvedValue({
      id: "payment-test",
      status: "pending",
      amountKopecks: 29_000,
      planCode: "pro_monthly",
      metadata: {
        confirmation: { confirmation_url: checkoutUrl },
        metadata: { paymentMode: "one_time" },
      },
    });
  });

  it("возвращает тот же checkout на втором устройстве без нового платежа", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      confirmationUrl: checkoutUrl,
      internalId: "payment-test",
      status: "pending",
      resumed: true,
    });
    expect(mocks.createYooPayment).not.toHaveBeenCalled();
  });

  it("не открывает старый checkout для другого тарифа", async () => {
    const response = await POST(request("pro_yearly"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Предыдущая оплата подписки ещё обрабатывается. Дождитесь результата.",
    });
    expect(mocks.createYooPayment).not.toHaveBeenCalled();
  });
});
