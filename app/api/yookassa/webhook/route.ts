import { z } from "zod";

import {
  applyFetchedYooPayment,
  PaymentVerificationError,
} from "@/lib/billing/settlement";
import {
  applyFetchedYooRefund,
  getRefundPaymentByProviderPaymentId,
  RefundUnavailableError,
} from "@/lib/billing/refunds";
import {
  getYooPayment,
  getYooRefund,
  isYookassaConfigured,
  YOOKASSA_IP_WHITELIST,
  YookassaApiError,
} from "@/lib/billing/yookassa";
import { shouldCheckYookassaWebhookIp } from "@/lib/billing/readiness";
import { ipInAnyCidr } from "@/lib/net/cidr";
import {
  findByProviderId,
  getPaymentById,
} from "@/lib/repos/payments.repo";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const eventSchema = z.object({
  type: z.literal("notification"),
  event: z.enum([
    "payment.succeeded",
    "payment.waiting_for_capture",
    "payment.canceled",
    "refund.succeeded",
  ]),
  object: z.object({ id: z.string().min(1) }).passthrough(),
});

/** ЮKassa webhook: payload сообщает только ID события.
 *
 * Денежное решение принимается исключительно после server-to-server
 * GET /payments/{id}, строгой сверки ID/суммы/RUB/metadata/mode и
 * транзакционного settlement с row lock. */
export async function POST(request: Request) {
  if (!isYookassaConfigured()) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  if (shouldCheckYookassaWebhookIp()) {
    const sourceIp = extractSourceIp(request.headers);
    if (!sourceIp || !ipInAnyCidr(sourceIp, YOOKASSA_IP_WHITELIST)) {
      console.warn("[yookassa-webhook] rejected source ip");
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Bad payload" }, { status: 400 });
  }

  if (parsed.data.event === "refund.succeeded") {
    return handleRefundEvent(parsed.data.object.id);
  }

  let provider;
  try {
    provider = await getYooPayment(parsed.data.object.id);
  } catch (error) {
    console.error(
      "[yookassa-webhook] provider verification failed",
      error instanceof YookassaApiError
        ? { operation: error.operation, status: error.status }
        : {},
    );
    // Non-200 заставит ЮKassa повторить уведомление, когда API восстановится.
    return Response.json({ error: "Verification unavailable" }, { status: 503 });
  }

  let local = await findByProviderId("yookassa", provider.id);
  if (!local && provider.metadata?.internalId) {
    // Recovery окна «ЮKassa создала объект, attach в БД не успел»: internalId
    // доверяем только из только что полученного Basic-auth GET-ответа.
    const candidate = await getPaymentById(provider.metadata.internalId);
    if (
      candidate?.provider === "yookassa" &&
      (!candidate.providerPaymentId ||
        candidate.providerPaymentId === provider.id)
    ) {
      local = candidate;
    }
  }

  if (!local) {
    // Чужой/удалённый объект нельзя применить. Подтверждаем, чтобы не создавать
    // бесконечный retry storm.
    console.warn("[yookassa-webhook] unknown provider payment");
    return Response.json({ ok: true, note: "unknown" });
  }

  try {
    const result = await applyFetchedYooPayment(local, provider);
    console.info("[yookassa-webhook] payment reconciled", {
      paymentId: local.id,
      kind: local.kind,
      status: result.status,
      alreadyApplied: result.alreadyApplied,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      console.error("[yookassa-webhook] rejected verified object", {
        paymentId: local.id,
        reason: error.reason,
      });
      return Response.json({ error: "Payment mismatch" }, { status: 409 });
    }
    console.error("[yookassa-webhook] settlement failed", {
      paymentId: local.id,
    });
    return Response.json({ error: "Settlement failed" }, { status: 503 });
  }
}

async function handleRefundEvent(refundId: string) {
  let refund;
  try {
    refund = await getYooRefund(refundId);
  } catch (error) {
    console.error(
      "[yookassa-webhook] refund verification unavailable",
      error instanceof YookassaApiError
        ? { operation: error.operation, status: error.status }
        : {},
    );
    return Response.json({ error: "Verification unavailable" }, { status: 503 });
  }

  const local = await getRefundPaymentByProviderPaymentId(refund.payment_id);
  if (!local) {
    console.warn("[yookassa-webhook] unknown refund payment");
    return Response.json({ ok: true, note: "unknown_refund" });
  }

  try {
    const result = await applyFetchedYooRefund(local, refund);
    console.info("[yookassa-webhook] refund reconciled", {
      paymentId: local.id,
      status: result.status,
      alreadyApplied: result.alreadyApplied,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof RefundUnavailableError) {
      console.error("[yookassa-webhook] refund mismatch", {
        paymentId: local.id,
        reason: error.reason,
      });
      return Response.json({ error: "Refund mismatch" }, { status: 409 });
    }
    return Response.json({ error: "Refund settlement failed" }, { status: 503 });
  }
}

function extractSourceIp(headers: Headers): string | null {
  const raw =
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!raw) return null;

  // [2a02:5180::1]:443 → 2a02:5180::1
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(raw);
  if (bracketed) return bracketed[1] ?? null;
  // 185.71.76.1:443 → 185.71.76.1. Голый IPv6 не режем по двоеточию.
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(raw);
  return ipv4WithPort?.[1] ?? raw;
}
