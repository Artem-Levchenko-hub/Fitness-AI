import { headers } from "next/headers";

import { credit } from "@/lib/repos/credits.repo";
import {
  findByProviderId,
  updatePaymentStatus,
} from "@/lib/repos/payments.repo";
import {
  YOOKASSA_IP_WHITELIST,
  isYookassaConfigured,
} from "@/lib/billing/yookassa";

export const runtime = "nodejs";

/** ЮKassa webhook. Принимает уведомления о статусе платежа.
 *  https://yookassa.ru/developers/using-api/webhooks
 *
 *  Защита: фильтр по IP-whitelist. Подпись HMAC опциональна и обычно не
 *  настраивается для базовой интеграции — IP-фильтр + verifyById через
 *  GET /payments/{id} перед зачислением. */
export async function POST(request: Request) {
  if (!isYookassaConfigured()) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  // 1. Проверка IP (Cloudflare/nginx подставляют X-Forwarded-For)
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");
  const sourceIp = (forwardedFor?.split(",")[0]?.trim() ?? realIp ?? "").trim();

  if (sourceIp && !isIpAllowed(sourceIp)) {
    console.warn(`[yookassa-webhook] rejected source ip: ${sourceIp}`);
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Парсинг тела
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = body as {
    event?: string;
    object?: {
      id?: string;
      status?: string;
      amount?: { value?: string; currency?: string };
      paid?: boolean;
      metadata?: { internalId?: string; userId?: string };
    };
  };

  if (!event.event || !event.object?.id) {
    return Response.json({ error: "Bad payload" }, { status: 400 });
  }

  const yooId = event.object.id;
  const payment = await findByProviderId("yookassa", yooId);
  if (!payment) {
    // Не наш платёж (или метадата потерялась). Возвращаем 200, чтобы
    // ЮKassa не повторяла бесконечно.
    console.warn(`[yookassa-webhook] unknown payment id: ${yooId}`);
    return Response.json({ ok: true, note: "unknown" });
  }

  // 3. Обработка по событию
  switch (event.event) {
    case "payment.succeeded": {
      await updatePaymentStatus(payment.id, "succeeded", event as unknown as Record<string, unknown>);
      // Зачисление credits — идемпотентное по (yookassa_payment, yooId)
      const result = await credit(
        payment.userId,
        payment.amountKopecks,
        `Пополнение через ЮKassa (${(payment.amountKopecks / 100).toFixed(0)} ₽)`,
        { id: yooId, type: "yookassa_payment" },
        "purchase",
      );
      console.info(
        `[yookassa-webhook] credited user=${payment.userId} amount=${payment.amountKopecks} alreadyApplied=${result.alreadyApplied}`,
      );
      break;
    }
    case "payment.canceled": {
      await updatePaymentStatus(payment.id, "canceled", event as unknown as Record<string, unknown>);
      break;
    }
    case "payment.waiting_for_capture": {
      await updatePaymentStatus(
        payment.id,
        "waiting_for_capture",
        event as unknown as Record<string, unknown>,
      );
      break;
    }
    default:
      console.info(`[yookassa-webhook] ignored event: ${event.event}`);
  }

  return Response.json({ ok: true });
}

function isIpAllowed(ip: string): boolean {
  // В dev (без X-Forwarded-For из ЮKassa) пропускаем — иначе нельзя
  // протестировать. На проде nginx всегда подставит X-Forwarded-For.
  if (!ip) return true;

  for (const cidr of YOOKASSA_IP_WHITELIST) {
    if (cidr.includes("/")) {
      if (ipInCidr(ip, cidr)) return true;
    } else if (ip === cidr) {
      return true;
    }
  }
  return false;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split("/");
  if (!base || !prefixStr) return false;
  const prefix = parseInt(prefixStr, 10);

  // IPv4 only — для IPv6 пропускаем (наша инфра v4)
  if (ip.includes(":") || base.includes(":")) return false;

  const ipNum = ipv4ToNum(ip);
  const baseNum = ipv4ToNum(base);
  if (ipNum === null || baseNum === null) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

function ipv4ToNum(ip: string): number | null {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return (
    ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>>
    0
  );
}
