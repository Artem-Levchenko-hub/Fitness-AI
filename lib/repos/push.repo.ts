import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { NewPushSubscription, PushSubscription } from "@/db/schema";

export type PushKindLiteral = (typeof schema.pushKind.enumValues)[number];

export async function subscribeUser(
  userId: string,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  },
): Promise<PushSubscription> {
  const [row] = await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      lastUsedAt: new Date(),
    } satisfies NewPushSubscription)
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt: new Date(),
        disabledAt: null,
      },
    })
    .returning();
  if (!row) throw new Error("subscribeUser вернул пустой результат");
  return row;
}

export async function unsubscribeByEndpoint(endpoint: string): Promise<void> {
  await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint));
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
