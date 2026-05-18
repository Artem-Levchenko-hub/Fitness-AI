"use server";

import { requireUser } from "@/lib/auth/require-user";
import { subscribeUser, unsubscribeByEndpoint } from "@/lib/repos/push.repo";

export async function saveSubscription(payload: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}) {
  const user = await requireUser();
  await subscribeUser(user.id, {
    endpoint: payload.endpoint,
    p256dh: payload.keys.p256dh,
    auth: payload.keys.auth,
    userAgent: payload.userAgent ?? null,
  });
}

export async function removeSubscription(endpoint: string) {
  await requireUser();
  await unsubscribeByEndpoint(endpoint);
}
