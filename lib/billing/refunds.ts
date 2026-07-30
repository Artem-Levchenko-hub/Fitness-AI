import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  parseYooRubAmountToKopecks,
  verifyYooRefund,
} from "@/lib/billing/payment-verification";
import {
  createYooRefund,
  getYooRefund,
  type YooRefund,
} from "@/lib/billing/yookassa";
import { getPaymentById } from "@/lib/repos/payments.repo";

const PROVIDER_IDEMPOTENCE_WINDOW_MS = 23 * 60 * 60_000;

export class RefundUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Refund unavailable: ${reason}`);
    this.name = "RefundUnavailableError";
  }
}

function verifyRefundIdentity(
  refund: YooRefund,
  payment: schema.Payment,
): void {
  if (refund.payment_id !== payment.providerPaymentId) {
    throw new RefundUnavailableError("payment_id_mismatch");
  }
  if (
    refund.amount.currency !== "RUB" ||
    parseYooRubAmountToKopecks(refund.amount.value) !==
      payment.amountKopecks
  ) {
    throw new RefundUnavailableError("amount_mismatch");
  }
}

/** Резервирует внутренние credits ДО внешнего refund.
 *
 * После ambiguous timeout сумма остаётся недоступной пользователю, пока
 * webhook/reconcile не подтвердит succeeded или canceled. */
async function reserveTopupRefund(input: {
  paymentId: string;
  adminUserId: string;
  reason: string;
}) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, input.paymentId))
      .for("update")
      .limit(1);
    if (!payment) throw new RefundUnavailableError("payment_not_found");
    if (payment.status === "refunded" || payment.status === "refund_pending") {
      return payment;
    }
    if (
      payment.kind !== "topup" ||
      payment.status !== "succeeded" ||
      !payment.providerPaymentId
    ) {
      throw new RefundUnavailableError("payment_not_refundable");
    }

    const [wallet] = await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, payment.userId))
      .for("update")
      .limit(1);
    if (!wallet || wallet.balanceKopecks < payment.amountKopecks) {
      throw new RefundUnavailableError("credited_funds_already_used");
    }

    const [updatedWallet] = await tx
      .update(schema.userCredits)
      .set({
        balanceKopecks: sql`${schema.userCredits.balanceKopecks} - ${payment.amountKopecks}`,
      })
      .where(eq(schema.userCredits.userId, payment.userId))
      .returning({ balance: schema.userCredits.balanceKopecks });
    if (!updatedWallet) throw new Error("Refund reservation failed");

    await tx.insert(schema.creditTransactions).values({
      userId: payment.userId,
      type: "refund",
      amountKopecks: -payment.amountKopecks,
      balanceAfterKopecks: updatedWallet.balance,
      description: "Резерв полного возврата через ЮKassa",
      referenceId: `refund-reserve:${payment.id}`,
      referenceType: "yookassa_payment",
    });

    const [reserved] = await tx
      .update(schema.payments)
      .set({
        status: "refund_pending",
        refundRequestedAt: new Date(),
        refundRequestedBy: input.adminUserId,
        refundReason: input.reason.slice(0, 500),
        failureCode: null,
      })
      .where(eq(schema.payments.id, payment.id))
      .returning();
    if (!reserved) throw new Error("Refund intent update failed");
    return reserved;
  });
}

export async function requestUnusedTopupRefund(input: {
  paymentId: string;
  adminUserId: string;
  reason: string;
}) {
  const payment = await reserveTopupRefund(input);
  if (payment.status === "refunded") {
    return {
      paymentId: payment.id,
      status: "refunded" as const,
      alreadyApplied: true,
    };
  }
  return reconcileYooRefund(payment);
}

export async function reconcileYooRefund(payment: schema.Payment) {
  if (payment.status === "refunded") {
    return {
      paymentId: payment.id,
      status: "refunded" as const,
      alreadyApplied: true,
    };
  }
  if (
    payment.status !== "refund_pending" ||
    !payment.providerPaymentId ||
    !payment.refundRequestedAt
  ) {
    throw new RefundUnavailableError("refund_not_recoverable");
  }

  let refund: YooRefund;
  if (payment.providerRefundId) {
    refund = await getYooRefund(payment.providerRefundId);
  } else {
    if (
      Date.now() - payment.refundRequestedAt.getTime() >
      PROVIDER_IDEMPOTENCE_WINDOW_MS
    ) {
      throw new RefundUnavailableError("manual_review_required");
    }
    refund = await createYooRefund({
      paymentId: payment.providerPaymentId,
      amountKopecks: payment.amountKopecks,
      description: `Возврат пополнения Fitness AI ${payment.id}`,
      idempotenceKey: `refund-${payment.id}`,
    });
  }

  await db
    .update(schema.payments)
    .set({
      providerRefundId: refund.id,
      metadata: {
        payment: payment.metadata,
        refund,
      },
    })
    .where(eq(schema.payments.id, payment.id));

  return applyFetchedYooRefund(payment, refund);
}

/** Применяет refund, заново полученный у ЮKassa.
 *
 * Поддерживает как наш зарезервированный refund, так и полный refund,
 * созданный владельцем напрямую в кабинете ЮKassa. */
export async function applyFetchedYooRefund(
  local: schema.Payment,
  refund: YooRefund,
) {
  verifyRefundIdentity(refund, local);

  if (refund.status === "pending") {
    return {
      paymentId: local.id,
      status: "refund_pending" as const,
      alreadyApplied: false,
    };
  }

  if (refund.status === "canceled") {
    return compensateCanceledRefund(local.id, refund);
  }

  const verified = verifyYooRefund(refund, {
    providerPaymentId: local.providerPaymentId!,
    amountKopecks: local.amountKopecks,
  });
  if (!verified.ok) throw new RefundUnavailableError(verified.reason);

  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, local.id))
      .for("update")
      .limit(1);
    if (!payment) throw new RefundUnavailableError("payment_not_found");
    if (payment.status === "refunded") {
      return {
        paymentId: payment.id,
        status: "refunded" as const,
        alreadyApplied: true,
      };
    }

    if (payment.status === "succeeded") {
      if (payment.kind === "topup") {
        // Refund был создан напрямую в кабинете: снимаем credits даже если они
        // уже потрачены. Отрицательный остаток честно фиксирует долг и блокирует
        // дальнейшие debit до пополнения.
        await tx
          .insert(schema.userCredits)
          .values({ userId: payment.userId })
          .onConflictDoNothing();
        await tx
          .select()
          .from(schema.userCredits)
          .where(eq(schema.userCredits.userId, payment.userId))
          .for("update")
          .limit(1);
        const [wallet] = await tx
          .update(schema.userCredits)
          .set({
            balanceKopecks: sql`${schema.userCredits.balanceKopecks} - ${payment.amountKopecks}`,
          })
          .where(eq(schema.userCredits.userId, payment.userId))
          .returning({ balance: schema.userCredits.balanceKopecks });
        if (!wallet) throw new Error("External refund wallet update failed");
        await tx.insert(schema.creditTransactions).values({
          userId: payment.userId,
          type: "refund",
          amountKopecks: -payment.amountKopecks,
          balanceAfterKopecks: wallet.balance,
          description: "Возврат через кабинет ЮKassa",
          referenceId: refund.id,
          referenceType: "yookassa_payment",
        });
      } else {
        // Подписка не пополняла кошелёк. Если возвращён последний оплаченный
        // период, сразу прекращаем доступ и будущие списания. Возврат более
        // старого периода не должен отменять уже оплаченную новую подписку.
        await tx
          .update(schema.subscriptions)
          .set({
            tier: "free",
            status: "canceled",
            currentPeriodEnd: new Date(),
            nextChargeAt: null,
            cancelAtPeriodEnd: true,
            canceledAt: new Date(),
            providerPaymentMethodId: null,
            lastError: "last_subscription_payment_refunded",
          })
          .where(
            and(
              eq(schema.subscriptions.userId, payment.userId),
              eq(schema.subscriptions.lastPaymentId, payment.id),
            ),
          );
      }
    } else if (payment.status !== "refund_pending") {
      throw new RefundUnavailableError("invalid_local_refund_state");
    }

    await tx
      .update(schema.payments)
      .set({
        status: "refunded",
        refundedAt: new Date(),
        providerRefundId: refund.id,
        failureCode: null,
        metadata: { payment: payment.metadata, refund },
      })
      .where(eq(schema.payments.id, payment.id));

    return {
      paymentId: payment.id,
      status: "refunded" as const,
      alreadyApplied: false,
    };
  });
}

async function compensateCanceledRefund(
  paymentId: string,
  refund: YooRefund,
) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .for("update")
      .limit(1);
    if (!payment) throw new RefundUnavailableError("payment_not_found");
    if (payment.status !== "refund_pending") {
      return {
        paymentId: payment.id,
        status: payment.status,
        alreadyApplied: true,
      };
    }

    await tx
      .insert(schema.userCredits)
      .values({ userId: payment.userId })
      .onConflictDoNothing();
    await tx
      .select()
      .from(schema.userCredits)
      .where(eq(schema.userCredits.userId, payment.userId))
      .for("update")
      .limit(1);
    const [wallet] = await tx
      .update(schema.userCredits)
      .set({
        balanceKopecks: sql`${schema.userCredits.balanceKopecks} + ${payment.amountKopecks}`,
      })
      .where(eq(schema.userCredits.userId, payment.userId))
      .returning({ balance: schema.userCredits.balanceKopecks });
    if (!wallet) throw new Error("Refund compensation failed");
    await tx.insert(schema.creditTransactions).values({
      userId: payment.userId,
      type: "adjustment",
      amountKopecks: payment.amountKopecks,
      balanceAfterKopecks: wallet.balance,
      description: "Компенсация отменённого возврата ЮKassa",
      referenceId: `refund-compensate:${refund.id}`,
      referenceType: "yookassa_payment",
    });
    await tx
      .update(schema.payments)
      .set({
        status: "succeeded",
        providerRefundId: refund.id,
        failureCode: "refund_canceled",
        metadata: { payment: payment.metadata, refund },
      })
      .where(eq(schema.payments.id, payment.id));
    return {
      paymentId: payment.id,
      status: "succeeded" as const,
      alreadyApplied: false,
    };
  });
}

export async function getRefundPaymentByProviderPaymentId(
  providerPaymentId: string,
) {
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.provider, "yookassa"),
        eq(schema.payments.providerPaymentId, providerPaymentId),
      ),
    )
    .limit(1);
  return payment ?? null;
}

export async function refreshRefundPayment(paymentId: string) {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new RefundUnavailableError("payment_not_found");
  return reconcileYooRefund(payment);
}
