import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBillingReadiness: vi.fn(),
  listUpcomingRenewals: vi.fn(),
  expirePastDueSubscriptions: vi.fn(),
  listDueSubscriptions: vi.fn(),
  markRenewalReminderSent: vi.fn(),
  markSubscriptionRenewalFailed: vi.fn(),
  sendRenewalReminder: vi.fn(),
}));

vi.mock("@/lib/billing/readiness", () => ({
  getBillingReadiness: mocks.getBillingReadiness,
}));
vi.mock("@/lib/repos/subscriptions.repo", () => ({
  expirePastDueSubscriptions: mocks.expirePastDueSubscriptions,
  listDueSubscriptions: mocks.listDueSubscriptions,
  listUpcomingRenewals: mocks.listUpcomingRenewals,
  markRenewalReminderSent: mocks.markRenewalReminderSent,
  markSubscriptionRenewalFailed: mocks.markSubscriptionRenewalFailed,
}));
vi.mock("@/lib/billing/subscription-email", () => ({
  sendRenewalReminder: mocks.sendRenewalReminder,
}));
vi.mock("@/db/client", () => ({
  db: { transaction: vi.fn() },
}));
vi.mock("@/db/schema", () => ({}));
vi.mock("@/lib/billing/settlement", () => ({
  applyFetchedYooPayment: vi.fn(),
  reconcileYooPayment: vi.fn(),
}));
vi.mock("@/lib/billing/yookassa", () => ({
  createYooPayment: vi.fn(),
  YookassaApiError: class YookassaApiError extends Error {},
}));
vi.mock("@/lib/repos/payments.repo", () => ({
  getOrCreatePaymentRecord: vi.fn(),
  markPaymentFailed: vi.fn(),
}));

import { POST } from "./route";

describe("subscriptions cron readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "0123456789abcdef");
    mocks.listUpcomingRenewals.mockResolvedValue([]);
    mocks.expirePastDueSubscriptions.mockResolvedValue([]);
    mocks.listDueSubscriptions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed before email, database or provider work when subscriptions are disabled", async () => {
    mocks.getBillingReadiness.mockReturnValue({
      paymentsEnabled: false,
      subscriptionsEnabled: false,
      mode: "live",
      paymentMissing: ["BILLING_ENABLED"],
      subscriptionMissing: ["BILLING_ENABLED", "SUBSCRIPTION_ENABLED"],
    });

    const response = await POST(
      new Request("https://fitnesss.online/api/cron/subscriptions", {
        method: "POST",
        headers: { authorization: "Bearer 0123456789abcdef" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "subscriptions_not_ready",
      mode: "live",
      missing: ["BILLING_ENABLED", "SUBSCRIPTION_ENABLED"],
    });
    expect(mocks.listUpcomingRenewals).not.toHaveBeenCalled();
    expect(mocks.expirePastDueSubscriptions).not.toHaveBeenCalled();
    expect(mocks.listDueSubscriptions).not.toHaveBeenCalled();
    expect(mocks.sendRenewalReminder).not.toHaveBeenCalled();
  });

  it("runs an empty tick only when the subscription contour is ready", async () => {
    mocks.getBillingReadiness.mockReturnValue({
      paymentsEnabled: true,
      subscriptionsEnabled: true,
      mode: "test",
      paymentMissing: [],
      subscriptionMissing: [],
    });

    const response = await POST(
      new Request("https://fitnesss.online/api/cron/subscriptions", {
        method: "POST",
        headers: { authorization: "Bearer 0123456789abcdef" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      processed: 0,
      expired: 0,
      remindersSent: 0,
      results: [],
    });
    expect(mocks.listUpcomingRenewals).toHaveBeenCalledOnce();
    expect(mocks.expirePastDueSubscriptions).toHaveBeenCalledOnce();
    expect(mocks.listDueSubscriptions).toHaveBeenCalledOnce();
  });
});
