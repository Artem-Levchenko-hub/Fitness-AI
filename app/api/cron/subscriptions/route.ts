import { createHash } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  advanceUtcCalendarPeriod,
  getBillingPlan,
  isBillingPlanCode,
} from "@/lib/billing/plans";
import {
  applyFetchedYooPayment,
  reconcileYooPayment,
} from "@/lib/billing/settlement";
import {
  createYooPayment,
  YookassaApiError,
} from "@/lib/billing/yookassa";
import { sendRenewalReminder } from "@/lib/billing/subscription-email";
import {
  getOrCreatePaymentRecord,
  markPaymentFailed,
} from "@/lib/repos/payments.repo";
import {
  expirePastDueSubscriptions,
  listDueSubscriptions,
  listUpcomingRenewals,
  markRenewalReminderSent,
  markSubscriptionRenewalFailed,
} from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function renewalKey(
  userId: string,
  periodStart: Date,
  attempt: number,
): string {
  const digest = createHash("sha256")
    .update(`${userId}:${periodStart.toISOString()}:${attempt}`)
    .digest("hex")
    .slice(0, 48);
  return `renew-${digest}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const upcoming = await listUpcomingRenewals(
    now,
    new Date(now.getTime() + 7 * 86_400_000),
  );
  let remindersSent = 0;
  for (const item of upcoming) {
    const subscription = item.subscription;
    if (
      subscription.renewalReminderSentAt ||
      !subscription.nextChargeAt ||
      !subscription.priceKopecks
    ) {
      continue;
    }
    const leadDays = subscription.planCode === "pro_yearly" ? 7 : 3;
    if (
      subscription.nextChargeAt.getTime() - now.getTime() >
      leadDays * 86_400_000
    ) {
      continue;
    }
    try {
      await sendRenewalReminder({
        email: item.customerEmail,
        amountKopecks: subscription.priceKopecks,
        chargeAt: subscription.nextChargeAt,
      });
      await markRenewalReminderSent(subscription.userId, now);
      remindersSent += 1;
    } catch {
      // Email не блокирует саму подписку; следующий hourly tick повторит.
      console.error("[subscriptions] renewal reminder failed", {
        userId: subscription.userId,
      });
    }
  }

  const expired = await expirePastDueSubscriptions(now);
  const due = await listDueSubscriptions(now, 25);
  const results: Array<{
    userId: string;
    ok: boolean;
    status?: string;
    error?: string;
  }> = [];

  for (const item of due) {
    const subscription = item.subscription;
    let renewalPaymentId: string | null = null;
    try {
      if (
        !subscription.planCode ||
        !isBillingPlanCode(subscription.planCode) ||
        !subscription.providerPaymentMethodId ||
        !subscription.currentPeriodEnd
      ) {
        await markSubscriptionRenewalFailed(
          subscription.userId,
          "invalid_subscription_state",
          now,
        );
        results.push({
          userId: subscription.userId,
          ok: false,
          error: "invalid_subscription_state",
        });
        continue;
      }

      const plan = getBillingPlan(subscription.planCode);
      // Автопродление списывает ровно цену, на которую пользователь дал
      // согласие. Новая каталожная цена применяется только через новый checkout.
      const renewalAmount =
        subscription.priceKopecks ?? plan.priceKopecks;
      const periodStart = subscription.currentPeriodEnd;
      const periodEnd = advanceUtcCalendarPeriod(periodStart, plan.interval);
      const idempotencyKey = renewalKey(
        subscription.userId,
        periodStart,
        subscription.retryCount,
      );
      const description = `Продление Fitness AI ${plan.title}`;

      const { payment } = await getOrCreatePaymentRecord({
        userId: subscription.userId,
        idempotencyKey,
        kind: "subscription_renewal",
        amountKopecks: renewalAmount,
        description,
        receiptEmail: item.customerEmail,
        planCode: plan.code,
        periodStart,
        periodEnd,
        metadata: { source: "subscription_cron" },
      });
      renewalPaymentId = payment.id;

      if (payment.status === "succeeded") {
        results.push({
          userId: subscription.userId,
          ok: true,
          status: "already_succeeded",
        });
        continue;
      }

      if (payment.providerPaymentId) {
        const reconciled = await reconcileYooPayment(payment);
        results.push({
          userId: subscription.userId,
          ok: true,
          status: reconciled.status,
        });
        continue;
      }

      const provider = await db.transaction(async (tx) => {
        // Serialize the due-charge decision with cancelSubscriptionAtPeriodEnd.
        // If cancel wins the row lock first, no provider request is created.
        const [lockedSubscription] = await tx
          .select()
          .from(schema.subscriptions)
          .where(eq(schema.subscriptions.userId, subscription.userId))
          .for("update")
          .limit(1);
        if (
          !lockedSubscription ||
          lockedSubscription.cancelAtPeriodEnd ||
          !lockedSubscription.providerPaymentMethodId ||
          !["active", "past_due"].includes(
            lockedSubscription.status ?? "",
          ) ||
          lockedSubscription.currentPeriodEnd?.getTime() !==
            periodStart.getTime()
        ) {
          await tx
            .update(schema.payments)
            .set({
              status: "canceled",
              canceledAt: new Date(),
              failureCode: "renewal_canceled_before_charge",
            })
            .where(
              and(
                eq(schema.payments.id, payment.id),
                inArray(schema.payments.status, [
                  "pending",
                  "waiting_for_capture",
                  "failed",
                ]),
              ),
            );
          return null;
        }

        const created = await createYooPayment({
          amountKopecks: renewalAmount,
          description,
          customerEmail: item.customerEmail,
          paymentMethodId: lockedSubscription.providerPaymentMethodId,
          metadata: {
            internalId: payment.id,
            userId: subscription.userId,
            kind: "subscription_renewal",
            planCode: plan.code,
          },
          idempotenceKey: idempotencyKey,
        });
        const attachedStatus =
          created.status === "waiting_for_capture"
            ? "waiting_for_capture"
            : "pending";
        await tx
          .update(schema.payments)
          .set({
            providerPaymentId: created.id,
            status: attachedStatus,
            metadata: created as unknown as Record<string, unknown>,
            failureCode: null,
          })
          .where(eq(schema.payments.id, payment.id));
        return created;
      });

      if (!provider) {
        results.push({
          userId: subscription.userId,
          ok: true,
          status: "canceled_before_charge",
        });
        continue;
      }

      const settled = await applyFetchedYooPayment(payment, provider);
      results.push({
        userId: subscription.userId,
        ok: true,
        status: settled.status,
      });
    } catch (error) {
      const code =
        error instanceof YookassaApiError
          ? `provider_${error.operation}_${error.status ?? "network"}`
          : "renewal_failed";
      // На следующем retry используется тот же period/key — двойного списания
      // не будет даже при ambiguous timeout.
      if (renewalPaymentId) await markPaymentFailed(renewalPaymentId, code);
      // Любая ошибка без проверенного provider.status=canceled считается
      // ambiguous: объект/списание могли уже появиться, а DB-attach/commit —
      // упасть. Не увеличиваем retryCount и не меняем idempotency key; тот же
      // ключ + webhook recovery не допустят второго списания.
      results.push({
        userId: subscription.userId,
        ok: false,
        error: code,
      });
    }
  }

  return Response.json({
    processed: results.length,
    expired: expired.length,
    remindersSent,
    results,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
