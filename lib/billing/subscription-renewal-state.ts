type SubscriptionPaymentKind =
  | "subscription_initial"
  | "subscription_renewal";

type ResolveRenewalStateInput = {
  kind: SubscriptionPaymentKind;
  newlySavedPaymentMethodId: string | null;
  existingPaymentMethodId: string | null;
  paymentRecurringConsentAt: Date | null;
  paymentRecurringConsentVersion: string | null;
  existingRecurringConsentAt: Date | null;
  existingRecurringConsentVersion: string | null;
  preserveCancellation: boolean;
};

export type SubscriptionRenewalState = {
  paymentMethodId: string | null;
  canAutoRenew: boolean;
  recurringConsentAt: Date | null;
  recurringConsentVersion: string | null;
};

/** Не переносит сохранённую карту/согласие в явно разовую новую подписку. */
export function resolveSubscriptionRenewalState({
  kind,
  newlySavedPaymentMethodId,
  existingPaymentMethodId,
  paymentRecurringConsentAt,
  paymentRecurringConsentVersion,
  existingRecurringConsentAt,
  existingRecurringConsentVersion,
  preserveCancellation,
}: ResolveRenewalStateInput): SubscriptionRenewalState {
  const recurringConsentAt =
    kind === "subscription_initial"
      ? paymentRecurringConsentAt
      : paymentRecurringConsentAt ?? existingRecurringConsentAt;
  const recurringConsentVersion =
    kind === "subscription_initial"
      ? paymentRecurringConsentVersion
      : paymentRecurringConsentVersion ?? existingRecurringConsentVersion;
  const mayUseSavedMethod =
    kind === "subscription_renewal" || recurringConsentAt !== null;
  const paymentMethodId = mayUseSavedMethod
    ? newlySavedPaymentMethodId ?? existingPaymentMethodId
    : null;

  return {
    paymentMethodId,
    canAutoRenew: paymentMethodId !== null && !preserveCancellation,
    recurringConsentAt,
    recurringConsentVersion,
  };
}
