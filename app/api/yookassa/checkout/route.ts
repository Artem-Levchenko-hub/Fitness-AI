import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { getBillingReadiness } from "@/lib/billing/readiness";
import { MAX_TOPUP_RUB, MIN_TOPUP_RUB, rubToKopecks } from "@/lib/billing/money";
import {
  createYooPayment,
  isYookassaPaymentInConfiguredMode,
  YookassaApiError,
} from "@/lib/billing/yookassa";
import {
  attachProviderPayment,
  countRecentPaymentIntents,
  getOrCreatePaymentRecord,
  markPaymentFailed,
  PaymentIdempotencyConflictError,
} from "@/lib/repos/payments.repo";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountRub: z.coerce
    .number()
    .int()
    .min(MIN_TOPUP_RUB)
    .max(MAX_TOPUP_RUB),
  idempotencyKey: z.string().uuid(),
});

const MAX_INTENTS_PER_TEN_MINUTES = 5;

export async function POST(request: Request) {
  const user = await requireUser();
  const readiness = getBillingReadiness();

  if (!readiness.paymentsEnabled) {
    return Response.json(
      { error: "Платежи пока не включены владельцем приложения" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Некорректные параметры платежа" }, { status: 400 });
  }

  const recent = await countRecentPaymentIntents(
    user.id,
    new Date(Date.now() - 10 * 60_000),
  );
  if (recent >= MAX_INTENTS_PER_TEN_MINUTES) {
    return Response.json(
      { error: "Слишком много попыток оплаты. Повторите через 10 минут." },
      { status: 429 },
    );
  }

  const amountKopecks = rubToKopecks(parsed.data.amountRub);
  const description = `Пополнение баланса Fitness AI на ${parsed.data.amountRub} ₽`;

  let local;
  try {
    local = await getOrCreatePaymentRecord({
      userId: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      kind: "topup",
      amountKopecks,
      description,
      receiptEmail: user.email,
      metadata: { source: "topup" },
    });
  } catch (error) {
    if (error instanceof PaymentIdempotencyConflictError) {
      return Response.json(
        { error: "Этот ключ оплаты уже использован" },
        { status: 409 },
      );
    }
    throw error;
  }

  if (local.payment.status === "succeeded") {
    return Response.json({
      internalId: local.payment.id,
      status: "succeeded",
      returnUrl: `/billing?payment=${local.payment.id}`,
    });
  }

  let provider;
  try {
    provider = await createYooPayment({
      amountKopecks,
      description,
      customerEmail: user.email,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=${local.payment.id}`,
      metadata: {
        internalId: local.payment.id,
        userId: user.id,
        kind: "topup",
      },
      idempotenceKey: parsed.data.idempotencyKey,
    });

    if (!isYookassaPaymentInConfiguredMode(provider)) {
      await markPaymentFailed(local.payment.id, "provider_mode_mismatch");
      return Response.json(
        { error: "Режим магазина ЮKassa не совпадает с настройкой приложения" },
        { status: 502 },
      );
    }

    await attachProviderPayment(
      local.payment.id,
      provider.id,
      provider.status,
      provider as unknown as Record<string, unknown>,
    );
  } catch (error) {
    await markPaymentFailed(
      local.payment.id,
      error instanceof YookassaApiError
        ? `provider_${error.operation}_${error.status ?? "network"}`
        : "provider_unknown",
    );
    return Response.json(
      { error: "ЮKassa временно недоступна. Повторите попытку позже." },
      { status: 502 },
    );
  }

  const confirmationUrl = provider.confirmation?.confirmation_url;
  if (!confirmationUrl) {
    await markPaymentFailed(local.payment.id, "confirmation_url_missing");
    return Response.json(
      { error: "ЮKassa не вернула ссылку подтверждения" },
      { status: 502 },
    );
  }

  return Response.json({
    confirmationUrl,
    internalId: local.payment.id,
    status: provider.status,
  });
}
