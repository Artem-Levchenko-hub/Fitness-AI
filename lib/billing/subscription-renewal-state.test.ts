import { describe, expect, it } from "vitest";

import { resolveSubscriptionRenewalState } from "./subscription-renewal-state";

describe("resolveSubscriptionRenewalState", () => {
  it("clears an old saved method and consent for a new one-time subscription", () => {
    const oldConsent = new Date("2026-01-01T00:00:00.000Z");

    expect(
      resolveSubscriptionRenewalState({
        kind: "subscription_initial",
        newlySavedPaymentMethodId: null,
        existingPaymentMethodId: "saved-method",
        paymentRecurringConsentAt: null,
        paymentRecurringConsentVersion: null,
        existingRecurringConsentAt: oldConsent,
        existingRecurringConsentVersion: "old-version",
        preserveCancellation: false,
      }),
    ).toEqual({
      paymentMethodId: null,
      canAutoRenew: false,
      recurringConsentAt: null,
      recurringConsentVersion: null,
    });
  });

  it("enables renewal for an initial payment with fresh consent and a saved method", () => {
    const consentAt = new Date("2026-08-02T00:00:00.000Z");

    expect(
      resolveSubscriptionRenewalState({
        kind: "subscription_initial",
        newlySavedPaymentMethodId: "new-method",
        existingPaymentMethodId: null,
        paymentRecurringConsentAt: consentAt,
        paymentRecurringConsentVersion: "2026-08-02",
        existingRecurringConsentAt: null,
        existingRecurringConsentVersion: null,
        preserveCancellation: false,
      }),
    ).toEqual({
      paymentMethodId: "new-method",
      canAutoRenew: true,
      recurringConsentAt: consentAt,
      recurringConsentVersion: "2026-08-02",
    });
  });

  it("preserves a renewal cancellation while retaining its saved method", () => {
    const consentAt = new Date("2026-01-01T00:00:00.000Z");

    expect(
      resolveSubscriptionRenewalState({
        kind: "subscription_renewal",
        newlySavedPaymentMethodId: null,
        existingPaymentMethodId: "saved-method",
        paymentRecurringConsentAt: null,
        paymentRecurringConsentVersion: null,
        existingRecurringConsentAt: consentAt,
        existingRecurringConsentVersion: "2026-01-01",
        preserveCancellation: true,
      }),
    ).toEqual({
      paymentMethodId: "saved-method",
      canAutoRenew: false,
      recurringConsentAt: consentAt,
      recurringConsentVersion: "2026-01-01",
    });
  });
});
