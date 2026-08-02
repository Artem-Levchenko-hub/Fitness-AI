"use server";

import { requireUser } from "@/lib/auth/require-user";
import { pushSubscriptionSchema } from "@/lib/push/subscription-input";
import { subscribeUser, unsubscribeByEndpoint } from "@/lib/repos/push.repo";

export async function saveSubscription(payload: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}) {
  const user = await requireUser();
  const parsed = pushSubscriptionSchema.parse(payload);
  await subscribeUser(user.id, {
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    userAgent: payload.userAgent ?? null,
  });
}

export async function removeSubscription(endpoint: string) {
  const user = await requireUser();
  await unsubscribeByEndpoint(user.id, endpoint);
}
