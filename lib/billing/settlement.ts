import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  advanceUtcCalendarPeriod,
  getBillingPlan,
  isBillingPlanCode,
} from "@/lib/billing/plans";
import { resolveSubscriptionRenewalState } from "@/lib/billing/subscription-renewal-state";
import {
  parseYooRubAmountToKopecks,
  verifyYooPayment,
} from "@/lib/billing/payment-verification";
import {
  getYooPayment,
  isYookassaTestMode,
  type YooPayment,
} from "@/lib/billing/yookassa";
import {
  markSubscriptionRenewalFailed,
} from "@/lib/repos/subscriptions.repo";

export type SettlementResult = {
  paymentId: string;
  status: (typeof schema.paymentStatus.enumValues)[number];
  alreadyApplied: boolean;
  balanceAfterKopecks?: number;
  subscriptionPeriodEnd?: Date;
};

export class PaymentVerificationError extends Error {
  constructor(readonly reason: string) {
    super(`YooKassa payment verification failed: ${reason}`);
    this.name = "PaymentVerificationError";
  }
}

function verifyPaymentIdentity(
  local: schema.Payment,
  provider: YooPayment,
): void {
  if (local.providerPaymentId && local.providerPaymentId !== provider.id) {
    throw new PaymentVerificationError("payment_id_mismatch");
  }
  if (provider.amount.currency !== "RUB") {
    throw new PaymentVerificationError("currency_mismatch");
  }
  const amountKopecks = parseYooRubAmountToKopecks(provider.amount.value);
  if (amountKopecks === null || amountKopecks !== local.amountKopecks) {
    throw new PaymentVerificationError("amount_mismatch");
  }
  if (provider.metadata?.internalId !== local.id) {
    throw new PaymentVerificationError("internal_id_mismatch");
  }
  if (provider.metadata?.userId !== local.userId) {
    throw new PaymentVerificationError("user_id_mismatch");
  }
  if (provider.test !== isYookassaTestMode()) {
    throw new PaymentVerificationError("mode_mismatch");
  }
}

/** Применяет уже повторно полученный у ЮKassa объект.
 *
 * Webhook-тело не является источником истины: сюда передаётся только результат
 * server-to-server GET /payments/{id}. */
export async function applyFetchedYooPayment(
  local: schema.Payment,
  provider: YooPayment,
): Promise<SettlementResult> {
  verifyPaymentIdentity(local, provider);

  if (provider.status !== "succeeded") {
    const status =
      provider.status === "canceled"
        ? "canceled"
        : provider.status === "waiting_for_capture"
          ? "waiting_for_capture"
          : "pending";

    const allowedCurrentStatuses =
      status === "canceled"
        ? (["pending", "waiting_for_capture", "failed"] as const)
        : status === "waiting_for_capture"
          ? (["pending", "failed"] as const)
          : (["pending", "failed"] as const);
    const transitioned = await db
      .update(schema.payments)
      .set({
        providerPaymentId: provider.id,
        status,
        metadata: provider as unknown as Record<string, unknown>,
        ...(status === "canceled" ? { canceledAt: new Date() } : {}),
      })
      .where(
        and(
          eq(schema.payments.id, local.id),
          inArray(schema.payments.status, allowedCurrentStatuses),
        ),
      )
      .returning({ id: schema.payments.id });

    if (
      status === "canceled" &&
      local.kind === "subscription_renewal" &&
      transitioned.length > 0
    ) {
      await markSubscriptionRenewalFailed(
        local.userId,
        "provider_payment_canceled",
      );
    }

    return {
      paymentId: local.id,
      status,
      alreadyApplied: transitioned.length === 0,
    };
  }

  const verified = verifyYooPayment(provider, {
    providerPaymentId: provider.id,
    amountKopecks: local.amountKopecks,
    internalId: local.id,
    userId: local.userId,
    test: isYookassaTestMode(),
  });
  if (!verified.ok) {
    throw new PaymentVerificationError(verified.reason);
  }

  return settleSucceededPayment(local.id, provider);
}

export async function reconcileYooPayment(
  local: schema.Payment,
): Promise<SettlementResult> {
  if (!local.providerPaymentId) {
    return {
      paymentId: local.id,
      status: local.status,
      alreadyApplied: false,
    };
  }
  const provider = await getYooPayment(local.providerPaymentId);
  return applyFetchedYooPayment(local, provider);
}

async function settleSucceededPayment(
  internalId: string,
  provider: YooPayment,
): Promise<SettlementResult> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, internalId))
      .for("update")
      .limit(1);

    if (!payment) throw new Error("Payment record not found");
    if (payment.status === "succeeded") {
      return {
        paymentId: payment.id,
        status: payment.status,
        alreadyApplied: true,
      };
    }
    if (payment.status === "refunded") {
      return {
        paymentId: payment.id,
        status: payment.status,
        alreadyApplied: true,
      };
    }

    // Повторяем инварианты уже под lock: между GET и транзакцией запись могла
    // измениться, но сумма/владелец/provider id — никогда.
    verifyPaymentIdentity(payment, provider);

    let balanceAfterKopecks: number | undefined;
    let subscriptionPeriodEnd: Date | undefined;

    if (payment.kind === "topup") {
      await tx
        .insert(schema.userCredits)
        .values({ userId: payment.userId })
        .onConflictDoNothing();

      const [wallet] = await tx
        .select()
        .from(schema.userCredits)
        .where(eq(schema.userCredits.userId, payment.userId))
        .for("update")
        .limit(1);
      if (!wallet) throw new Error("Wallet row not found");

      const [updated] = await tx
        .update(schema.userCredits)
        .set({
          balanceKopecks: sql`${schema.userCredits.balanceKopecks} + ${payment.amountKopecks}`,
          totalPurchasedKopecks: sql`${schema.userCredits.totalPurchasedKopecks} + ${payment.amountKopecks}`,
        })
        .where(eq(schema.userCredits.userId, payment.userId))
        .returning({ balance: schema.userCredits.balanceKopecks });
      if (!updated) throw new Error("Wallet update failed");
      balanceAfterKopecks = updated.balance;

      await tx.insert(schema.creditTransactions).values({
        userId: payment.userId,
        type: "purchase",
        amountKopecks: payment.amountKopecks,
        balanceAfterKopecks,
        description: `Пополнение через ЮKassa (${(payment.amountKopecks / 100).toFixed(0)} ₽)`,
        referenceId: provider.id,
        referenceType: "yookassa_payment",
      });
    } else {
      if (!payment.planCode || !isBillingPlanCode(payment.planCode)) {
        throw new Error("Subscription payment has no valid plan");
      }
      const plan = getBillingPlan(payment.planCode);
      let periodStart =
        payment.periodStart ??
        (provider.captured_at ? new Date(provider.captured_at) : new Date());
      let periodEnd =
        payment.periodEnd ??
        advanceUtcCalendarPeriod(periodStart, plan.interval);

      const [existing] = await tx
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, payment.userId))
        .for("update")
        .limit(1);

      // Defensive handling for two initial payments that were created before
      // the in-flight unique index existed: never discard the second paid
      // period. Stack it after the already active period.
      if (
        payment.kind === "subscription_initial" &&
        existing?.status === "active" &&
        existing.currentPeriodEnd &&
        existing.currentPeriodEnd > periodStart &&
        existing.lastPaymentId !== payment.id
      ) {
        periodStart = existing.currentPeriodEnd;
        periodEnd = advanceUtcCalendarPeriod(periodStart, plan.interval);
      }
      subscriptionPeriodEnd = periodEnd;

      const newlySavedMethod =
        provider.payment_method?.saved === true
          ? provider.payment_method.id ?? null
          : null;
      // Cancellation requested while a renewal was in flight always wins for
      // the *next* period. The already-created charge still grants its full
      // paid period, but settlement must not silently turn renewal back on.
      const preserveCancellation =
        payment.kind === "subscription_renewal" &&
        existing?.cancelAtPeriodEnd === true;
      const renewalState = resolveSubscriptionRenewalState({
        kind: payment.kind,
        newlySavedPaymentMethodId: newlySavedMethod,
        existingPaymentMethodId: existing?.providerPaymentMethodId ?? null,
        paymentRecurringConsentAt: payment.recurringConsentAt,
        paymentRecurringConsentVersion: payment.recurringConsentVersion,
        existingRecurringConsentAt: existing?.recurringConsentAt ?? null,
        existingRecurringConsentVersion:
          existing?.recurringConsentVersion ?? null,
        preserveCancellation,
      });

      await tx
        .insert(schema.subscriptions)
        .values({
          userId: payment.userId,
          provider: "yookassa",
          providerPaymentMethodId: renewalState.paymentMethodId,
          planCode: plan.code,
          priceKopecks: payment.amountKopecks,
          tier: "pro",
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextChargeAt: renewalState.canAutoRenew ? periodEnd : null,
          cancelAtPeriodEnd: !renewalState.canAutoRenew,
          canceledAt: renewalState.canAutoRenew ? null : new Date(),
          recurringConsentAt: renewalState.recurringConsentAt,
          recurringConsentVersion: renewalState.recurringConsentVersion,
          renewalReminderSentAt: null,
          retryCount: 0,
          lastPaymentId: payment.id,
          lastError: null,
        })
        .onConflictDoUpdate({
          target: schema.subscriptions.userId,
          set: {
            provider: "yookassa",
            providerPaymentMethodId: renewalState.paymentMethodId,
            planCode: plan.code,
            priceKopecks: payment.amountKopecks,
            tier: "pro",
            status: "active",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextChargeAt: renewalState.canAutoRenew ? periodEnd : null,
            cancelAtPeriodEnd: !renewalState.canAutoRenew,
            canceledAt: renewalState.canAutoRenew ? null : new Date(),
            recurringConsentAt: renewalState.recurringConsentAt,
            recurringConsentVersion: renewalState.recurringConsentVersion,
            renewalReminderSentAt: null,
            retryCount: 0,
            lastPaymentId: payment.id,
            lastError: null,
          },
        });
    }

    await tx
      .update(schema.payments)
      .set({
        providerPaymentId: provider.id,
        status: "succeeded",
        paidAt: provider.captured_at
          ? new Date(provider.captured_at)
          : new Date(),
        canceledAt: null,
        failureCode: null,
        metadata: provider as unknown as Record<string, unknown>,
      })
      .where(eq(schema.payments.id, payment.id));

    return {
      paymentId: payment.id,
      status: "succeeded" as const,
      alreadyApplied: false,
      ...(balanceAfterKopecks === undefined
        ? {}
        : { balanceAfterKopecks }),
      ...(subscriptionPeriodEnd === undefined
        ? {}
        : { subscriptionPeriodEnd }),
    };
  });
}
