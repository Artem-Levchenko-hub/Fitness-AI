import { and, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { NewPushSubscription, PushSubscription } from "@/db/schema";
import {
  normalizePushEndpoint,
  PUSH_SUBSCRIPTIONS_PER_USER_LIMIT,
} from "@/lib/push/endpoint-policy";

export type PushKindLiteral = (typeof schema.pushKind.enumValues)[number];

export class PushEndpointOwnershipError extends Error {
  constructor() {
    super("Push endpoint belongs to another account");
    this.name = "PushEndpointOwnershipError";
  }
}

export class PushSubscriptionLimitError extends Error {
  constructor() {
    super("Push subscription limit reached");
    this.name = "PushSubscriptionLimitError";
  }
}

export async function subscribeUser(
  userId: string,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  },
): Promise<PushSubscription> {
  const endpoint = normalizePushEndpoint(input.endpoint);
  return db.transaction(async (tx) => {
    // Lock the owner row so concurrent device registrations cannot bypass the
    // per-account fan-out limit.
    const [owner] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!owner) throw new Error("Push subscription owner not found");

    const [existing] = await tx
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing) {
      if (existing.userId !== userId) throw new PushEndpointOwnershipError();
      const [updated] = await tx
        .update(schema.pushSubscriptions)
        .set({
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          lastUsedAt: new Date(),
          disabledAt: null,
        })
        .where(
          and(
            eq(schema.pushSubscriptions.endpoint, endpoint),
            eq(schema.pushSubscriptions.userId, userId),
          ),
        )
        .returning();
      if (!updated) throw new Error("Push subscription update failed");
      return updated;
    }

    const [total] = await tx
      .select({ value: count() })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId));
    if ((total?.value ?? 0) >= PUSH_SUBSCRIPTIONS_PER_USER_LIMIT) {
      throw new PushSubscriptionLimitError();
    }

    const [created] = await tx
      .insert(schema.pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt: new Date(),
      } satisfies NewPushSubscription)
      .returning();
    if (!created) throw new Error("Push subscription creation failed");
    return created;
  });
}

export async function unsubscribeByEndpoint(
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        eq(schema.pushSubscriptions.endpoint, normalizePushEndpoint(endpoint)),
      ),
    );
}

export async function disableSubscription(endpoint: string): Promise<void> {
  await db
    .update(schema.pushSubscriptions)
    .set({ disabledAt: new Date() })
    .where(eq(schema.pushSubscriptions.endpoint, endpoint));
}

export async function getActiveForUser(
  userId: string,
): Promise<PushSubscription[]> {
  return db
    .select()
    .from(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, userId),
        isNull(schema.pushSubscriptions.disabledAt),
      ),
    );
}

export async function logNotification(input: {
  userId: string;
  kind: PushKindLiteral;
  payload: unknown;
  deliveredCount: number;
  error?: string | null;
}): Promise<void> {
  await db.insert(schema.notificationsLog).values({
    userId: input.userId,
    kind: input.kind,
    payload: input.payload as object,
    deliveredCount: input.deliveredCount,
    error: input.error ?? null,
  });
}
