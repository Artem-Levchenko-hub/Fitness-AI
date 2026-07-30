import "server-only";

import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { hasActiveProAccess } from "@/lib/billing/plans";

export async function getSubscriptionForUser(userId: string) {
  const [row] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function hasActiveProSubscription(
  userId: string,
  at = new Date(),
): Promise<boolean> {
  const subscription = await getSubscriptionForUser(userId);
  return subscription ? hasActiveProAccess(subscription, at) : false;
}

export async function listDueSubscriptions(now: Date, limit = 50) {
  return db
    .select({
      subscription: schema.subscriptions,
      customerEmail: schema.users.email,
    })
    .from(schema.subscriptions)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.subscriptions.userId),
    )
    .where(
      and(
        eq(schema.subscriptions.provider, "yookassa"),
        inArray(schema.subscriptions.status, ["active", "past_due"]),
        eq(schema.subscriptions.cancelAtPeriodEnd, false),
        isNotNull(schema.subscriptions.providerPaymentMethodId),
        lte(schema.subscriptions.nextChargeAt, now),
      ),
    )
    .limit(limit);
}

export async function listUpcomingRenewals(
  from: Date,
  to: Date,
  limit = 100,
) {
  return db
    .select({
      subscription: schema.subscriptions,
      customerEmail: schema.users.email,
    })
    .from(schema.subscriptions)
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.subscriptions.userId),
    )
    .where(
      and(
        eq(schema.subscriptions.provider, "yookassa"),
        eq(schema.subscriptions.status, "active"),
        eq(schema.subscriptions.cancelAtPeriodEnd, false),
        isNotNull(schema.subscriptions.providerPaymentMethodId),
        isNotNull(schema.subscriptions.nextChargeAt),
        gte(schema.subscriptions.nextChargeAt, from),
        lte(schema.subscriptions.nextChargeAt, to),
      ),
    )
    .limit(limit);
}

export async function markRenewalReminderSent(
  userId: string,
  sentAt: Date,
): Promise<void> {
  await db
    .update(schema.subscriptions)
    .set({ renewalReminderSentAt: sentAt })
    .where(eq(schema.subscriptions.userId, userId));
}

export async function cancelSubscriptionAtPeriodEnd(
  userId: string,
): Promise<boolean> {
  const rows = await db
    .update(schema.subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      nextChargeAt: null,
      canceledAt: new Date(),
    })
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        inArray(schema.subscriptions.status, [
          "trialing",
          "active",
          "past_due",
        ]),
      ),
    )
    .returning({ userId: schema.subscriptions.userId });
  return rows.length > 0;
}

export async function resumeSubscription(userId: string): Promise<boolean> {
  const now = new Date();
  const subscription = await getSubscriptionForUser(userId);
  if (
    !subscription ||
    subscription.status !== "active" ||
    !subscription.providerPaymentMethodId ||
    !subscription.currentPeriodEnd ||
    subscription.currentPeriodEnd <= now
  ) {
    return false;
  }

  const rows = await db
    .update(schema.subscriptions)
    .set({
      cancelAtPeriodEnd: false,
      canceledAt: null,
      nextChargeAt: subscription.currentPeriodEnd,
    })
    .where(
      and(
        eq(schema.subscriptions.userId, userId),
        eq(schema.subscriptions.status, "active"),
      ),
    )
    .returning({ userId: schema.subscriptions.userId });
  return rows.length > 0;
}

/** Отмечает провал автосписания и назначает ограниченные retry.
 *  После третьего провала автоплатежи прекращаются, но текущий оплаченный
 *  период не отнимается задним числом. */
export async function markSubscriptionRenewalFailed(
  userId: string,
  errorCode: string,
  now = new Date(),
): Promise<void> {
  const subscription = await getSubscriptionForUser(userId);
  if (!subscription) return;

  const retryCount = subscription.retryCount + 1;
  const retryDelayDays = retryCount === 1 ? 1 : retryCount === 2 ? 3 : 5;
  const terminal = retryCount >= 3;
  const nextChargeAt = terminal
    ? null
    : new Date(now.getTime() + retryDelayDays * 86_400_000);

  await db
    .update(schema.subscriptions)
    .set({
      status: "past_due",
      retryCount,
      nextChargeAt,
      lastError: errorCode.slice(0, 200),
      ...(terminal ? { cancelAtPeriodEnd: true } : {}),
    })
    .where(eq(schema.subscriptions.userId, userId));
}

export async function expirePastDueSubscriptions(now = new Date()) {
  return db
    .update(schema.subscriptions)
    .set({
      status: "canceled",
      tier: "free",
      nextChargeAt: null,
    })
    .where(
      and(
        inArray(schema.subscriptions.status, ["past_due", "active"]),
        lte(schema.subscriptions.currentPeriodEnd, now),
        eq(schema.subscriptions.cancelAtPeriodEnd, true),
      ),
    )
    .returning({ userId: schema.subscriptions.userId });
}
