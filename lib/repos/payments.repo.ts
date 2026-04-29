import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

type PaymentStatus = (typeof schema.paymentStatus.enumValues)[number];

export async function createPaymentRecord(input: {
  userId: string;
  amountKopecks: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.payments)
    .values({
      userId: input.userId,
      amountKopecks: input.amountKopecks,
      description: input.description,
      metadata: input.metadata ?? null,
    })
    .returning({ id: schema.payments.id });
  return { id: row!.id };
}

export async function attachProviderPaymentId(
  internalId: string,
  providerPaymentId: string,
  status: PaymentStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(schema.payments)
    .set({
      providerPaymentId,
      status,
      metadata: metadata ?? null,
    })
    .where(eq(schema.payments.id, internalId));
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

export async function updatePaymentStatus(
  internalId: string,
  status: PaymentStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(schema.payments)
    .set({
      status,
      ...(metadata ? { metadata } : {}),
    })
    .where(eq(schema.payments.id, internalId));
}
