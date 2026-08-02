import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { getResumableYookassaConfirmationUrl } from "@/lib/billing/payment-resume";
import {
  advanceUtcCalendarPeriod,
  getBillingPlan,
  isBillingPlanCode,
} from "@/lib/billing/plans";
import { getBillingReadiness } from "@/lib/billing/readiness";
import {
  createYooPayment,
  isYookassaPaymentInConfiguredMode,
  YookassaApiError,
} from "@/lib/billing/yookassa";
import { env } from "@/lib/env";
import {
  attachProviderPayment,
  countRecentPaymentIntents,
  getInitialSubscriptionPaymentInFlightForUser,
  getOrCreatePaymentRecord,
  markPaymentFailed,
  PaymentIdempotencyConflictError,
  SubscriptionPaymentInFlightError,
} from "@/lib/repos/payments.repo";
import { getSubscriptionForUser } from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    planCode: z.string().refine(isBillingPlanCode),
    idempotencyKey: z.string().uuid(),
    paymentMode: z.enum(["one_time", "recurring"]).optional(),
    acceptTerms: z.literal(true).optional(),
    // Совместимость с уже открытыми вкладками предыдущего релиза.
    acceptRecurringTerms: z.literal(true).optional(),
  })
  .refine(
    ({ acceptTerms, acceptRecurringTerms }) =>
      acceptTerms === true || acceptRecurringTerms === true,
  );

export async function POST(request: Request) {
  const user = await requireUser();
  const readiness = getBillingReadiness();
  if (!readiness.subscriptionsEnabled) {
    return Response.json(
      { error: "Подписка пока не включена владельцем приложения" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Подтвердите условия оплаты и выберите тариф" },
      { status: 400 },
    );
  }

  const paymentMode = readiness.recurringPaymentsEnabled
    ? "recurring"
    : "one_time";
  const requestedPaymentMode =
    parsed.data.paymentMode ??
    (parsed.data.acceptRecurringTerms === true ? "recurring" : null);
  if (requestedPaymentMode === null) {
    return Response.json(
      { error: "Обновите страницу и подтвердите условия оплаты заново." },
      { status: 400 },
    );
  }
  if (requestedPaymentMode !== paymentMode) {
    return Response.json(
      { error: "Условия оплаты изменились. Обновите страницу и подтвердите их заново." },
      { status: 409 },
    );
  }

  const existingSubscription = await getSubscriptionForUser(user.id);
  if (
    existingSubscription?.status === "active" &&
    existingSubscription.currentPeriodEnd &&
    existingSubscription.currentPeriodEnd > new Date()
  ) {
    return Response.json(
      { error: "У вас уже есть активная подписка" },
      { status: 409 },
    );
  }

  const recent = await countRecentPaymentIntents(
    user.id,
    new Date(Date.now() - 10 * 60_000),
  );
  if (recent >= 5) {
    return Response.json(
      { error: "Слишком много попыток оплаты. Повторите через 10 минут." },
      { status: 429 },
    );
  }

  const plan = getBillingPlan(parsed.data.planCode);
  const periodStart = new Date();
  const periodEnd = advanceUtcCalendarPeriod(periodStart, plan.interval);
  const description = `Подписка Fitness AI ${plan.title}`;
  const consentAt = paymentMode === "recurring" ? new Date() : null;

  let local;
  try {
    local = await getOrCreatePaymentRecord({
      userId: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      kind: "subscription_initial",
      planCode: plan.code,
      amountKopecks: plan.priceKopecks,
      description,
      receiptEmail: user.email,
      recurringConsentAt: consentAt,
      recurringConsentVersion: consentAt ? env.LEGAL_OFFER_VERSION : null,
      customerIp: request.headers.get("x-real-ip"),
      customerUserAgent: request.headers.get("user-agent"),
      periodStart,
      periodEnd,
      metadata: { source: "subscription_checkout", paymentMode },
    });
  } catch (error) {
    if (error instanceof PaymentIdempotencyConflictError) {
      return Response.json(
        { error: "Этот ключ оплаты уже использован" },
        { status: 409 },
      );
    }
    if (error instanceof SubscriptionPaymentInFlightError) {
      const inFlight =
        await getInitialSubscriptionPaymentInFlightForUser(user.id);
      const confirmationUrl = inFlight
        ? getResumableYookassaConfirmationUrl(inFlight, {
            amountKopecks: plan.priceKopecks,
            planCode: parsed.data.planCode,
            paymentMode,
          })
        : null;

      if (inFlight && confirmationUrl) {
        return Response.json({
          confirmationUrl,
          internalId: inFlight.id,
          status: inFlight.status,
          resumed: true,
        });
      }

      return Response.json(
        {
          error:
            "Предыдущая оплата подписки ещё обрабатывается. Дождитесь результата.",
        },
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
      amountKopecks: plan.priceKopecks,
      description,
      customerEmail: user.email,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=${local.payment.id}`,
      savePaymentMethod: paymentMode === "recurring",
      metadata: {
        internalId: local.payment.id,
        userId: user.id,
        kind: "subscription_initial",
        planCode: plan.code,
        paymentMode,
      },
      idempotenceKey: parsed.data.idempotencyKey,
    });

    if (!isYookassaPaymentInConfiguredMode(provider)) {
      await markPaymentFailed(local.payment.id, "provider_mode_mismatch");
      return Response.json(
        { error: "Режим магазина ЮKassa не совпадает с приложением" },
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
