import webpush from "web-push";

import { env } from "@/lib/env";
import {
  disableSubscription,
  logNotification,
  type PushKindLiteral,
} from "@/lib/repos/push.repo";
import type { PushSubscription } from "@/db/schema";
import {
  isSafePushEndpoint,
  PUSH_SUBSCRIPTIONS_PER_USER_LIMIT,
} from "@/lib/push/endpoint-policy";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }
  const subject = env.VAPID_SUBJECT.startsWith("mailto:")
    ? env.VAPID_SUBJECT
    : `mailto:${env.VAPID_SUBJECT}`;
  webpush.setVapidDetails(
    subject,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  kind: PushKindLiteral;
  title: string;
  body: string;
  /** Куда вести по клику. */
  url?: string;
  tag?: string;
};

export type SendResult = {
  delivered: number;
  failed: number;
  error?: string;
};

/** Отправляет уведомление на ВСЕ активные подписки юзера. 410 Gone / 404 —
 *  помечаем подписку disabled. Логирует в notifications_log. */
export async function sendPushToUser(
  userId: string,
  subscriptions: PushSubscription[],
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    return { delivered: 0, failed: 0, error: "VAPID не настроен" };
  }
  if (subscriptions.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  const json = JSON.stringify(payload);
  let delivered = 0;
  let failed = 0;
  let firstError: string | undefined;

  const boundedSubscriptions = subscriptions.slice(
    0,
    PUSH_SUBSCRIPTIONS_PER_USER_LIMIT,
  );
  await Promise.all(
    boundedSubscriptions.map(async (sub) => {
      if (!isSafePushEndpoint(sub.endpoint)) {
        failed += 1;
        firstError ??= "Unsupported stored push endpoint";
        await disableSubscription(sub.endpoint).catch(() => {});
        return;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          { TTL: 60 * 60 * 24 },
        );
        delivered += 1;
      } catch (err: unknown) {
        failed += 1;
        const e = err as { statusCode?: number; message?: string };
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await disableSubscription(sub.endpoint).catch(() => {});
        }
        if (!firstError) firstError = e?.message ?? String(err);
      }
    }),
  );

  await logNotification({
    userId,
    kind: payload.kind,
    payload,
    deliveredCount: delivered,
    error: firstError ?? null,
  });

  return { delivered, failed, error: firstError };
}
