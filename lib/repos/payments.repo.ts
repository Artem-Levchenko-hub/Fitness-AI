import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

type PaymentStatus = (typeof schema.paymentStatus.enumValues)[number];

export class PaymentIdempotencyConflictError extends Error {
  constructor() {
    super("Payment idempotency key is already used with different parameters");
    this.name = "PaymentIdempotencyConflictError";
  }
}

export class SubscriptionPaymentInFlightError extends Error {
  constructor() {
    super("A subscription payment is already in progress");
    this.name = "SubscriptionPaymentInFlightError";
  }
}

export type CreatePaymentRecordInput = {
  userId: string;
  idempotencyKey: string;
  kind: schema.PaymentKind;
  amountKopecks: number;
  description: string;
  receiptEmail: string;
  recurringConsentAt?: Date | null;
  recurringConsentVersion?: string | null;
  customerIp?: string | null;
  customerUserAgent?: string | null;
  planCode?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown>;
};

/** Создаёт durable payment intent или возвращает тот же intent при retry.
 *
 * Ключ приходит от клиента/cron и хранится в БД, поэтому повтор HTTP-запроса
 * не создаёт второй платёж у нас и у ЮKassa. Несовпадающие параметры под тем же
 * ключом считаются конфликтом, а не молча переиспользуются. */
export async function getOrCreatePaymentRecord(
  input: CreatePaymentRecordInput,
): Promise<{ payment: schema.Payment; created: boolean }> {
  let created: schema.Payment | undefined;
  try {
    [created] = await db
      .insert(schema.payments)
      .values({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        amountKopecks: input.amountKopecks,
        description: input.description,
        receiptEmail: input.receiptEmail,
        recurringConsentAt: input.recurringConsentAt ?? null,
        recurringConsentVersion: input.recurringConsentVersion ?? null,
        customerIp: input.customerIp?.slice(0, 80) ?? null,
        customerUserAgent: input.customerUserAgent?.slice(0, 500) ?? null,
        planCode: input.planCode ?? null,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        metadata: input.metadata ?? null,
      })
      .onConflictDoNothing({ target: schema.payments.idempotencyKey })
      .returning();
  } catch (error) {
    if (
      input.kind === "subscription_initial" &&
      typeof error === "object" &&
      error !== null &&
      ((error as { constraint_name?: unknown }).constraint_name ===
        "payments_initial_subscription_inflight_unq" ||
        (error as { constraint?: unknown }).constraint ===
          "payments_initial_subscription_inflight_unq")
    ) {
      throw new SubscriptionPaymentInFlightError();
    }
    throw error;
  }

  if (created) return { payment: created, created: true };

  const [existing] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (
    !existing ||
    existing.userId !== input.userId ||
    existing.kind !== input.kind ||
    existing.amountKopecks !== input.amountKopecks ||
    existing.planCode !== (input.planCode ?? null)
  ) {
    throw new PaymentIdempotencyConflictError();
  }

  return { payment: existing, created: false };
}

export async function attachProviderPayment(
  internalId: string,
  providerPaymentId: string,
  status: PaymentStatus,
  providerPayload: Record<string, unknown>,
): Promise<void> {
  // Financial success is applied only by verified settlement. Merely
  // attaching a provider object must never make settlement think the ledger
  // mutation already happened.
  const attachedStatus: PaymentStatus =
    status === "waiting_for_capture" ? "waiting_for_capture" : "pending";
  const updated = await db
    .update(schema.payments)
    .set({
      providerPaymentId,
      status: attachedStatus,
      metadata: providerPayload,
      failureCode: null,
    })
    .where(
      and(
        eq(schema.payments.id, internalId),
        inArray(schema.payments.status, [
          "pending",
          "waiting_for_capture",
          "failed",
        ]),
      ),
    )
    .returning({ id: schema.payments.id });

  if (updated.length === 0) {
    const [existing] = await db
      .select({
        providerPaymentId: schema.payments.providerPaymentId,
        status: schema.payments.status,
      })
      .from(schema.payments)
      .where(eq(schema.payments.id, internalId))
      .limit(1);

    // Идемпотентный retry attach после успешной записи.
    if (
      existing?.providerPaymentId === providerPaymentId &&
      (existing.status === attachedStatus || existing.status === "succeeded")
    ) {
      return;
    }
    throw new Error("Payment record cannot accept provider payment");
  }
}

/** Backwards-compatible alias для старых импортов. */
export const attachProviderPaymentId = attachProviderPayment;

export async function markPaymentFailed(
  internalId: string,
  failureCode: string,
): Promise<void> {
  await db
    .update(schema.payments)
    .set({
      status: "failed",
      failureCode: failureCode.slice(0, 120),
    })
    .where(
      and(
        eq(schema.payments.id, internalId),
        eq(schema.payments.status, "pending"),
      ),
    );
}

export async function findByProviderId(
  provider: string,
  providerPaymentId: string,
) {
  const [row] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.provider, provider),
        eq(schema.payments.providerPaymentId, providerPaymentId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getPaymentById(internalId: string) {
  const [row] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, internalId))
    .limit(1);
  return row ?? null;
}

export async function getPaymentForUser(
  userId: string,
  internalId: string,
) {
  const [row] = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.id, internalId),
        eq(schema.payments.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listRecoverablePayments(limit = 50) {
  return db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.provider, "yookassa"),
        inArray(schema.payments.status, ["pending", "waiting_for_capture"]),
      ),
    )
    .orderBy(desc(schema.payments.createdAt))
    .limit(limit);
}

export async function countRecentPaymentIntents(
  userId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.userId, userId),
        gte(schema.payments.createdAt, since),
      ),
    );
  return row?.count ?? 0;
}

/** Используется только для provider non-success переходов.
 *  `succeeded`/`refunded` никогда не откатываются поздним canceled webhook. */
export async function updatePaymentStatus(
  internalId: string,
  status: PaymentStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (status === "succeeded" || status === "refunded") {
    throw new Error("Financial success states must be applied by settlement");
  }

  await db
    .update(schema.payments)
    .set({
      status,
      ...(status === "canceled" ? { canceledAt: new Date() } : {}),
      ...(metadata ? { metadata } : {}),
    })
    .where(
      and(
        eq(schema.payments.id, internalId),
        inArray(schema.payments.status, [
          "pending",
          "waiting_for_capture",
          "failed",
        ]),
      ),
    );
}
