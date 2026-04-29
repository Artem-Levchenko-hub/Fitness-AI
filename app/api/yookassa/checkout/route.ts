import { z } from "zod";

import { env } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";
import { MAX_TOPUP_RUB, MIN_TOPUP_RUB, rubToKopecks } from "@/lib/billing/pricing";
import {
  createYooPayment,
  isYookassaConfigured,
} from "@/lib/billing/yookassa";
import {
  attachProviderPaymentId,
  createPaymentRecord,
} from "@/lib/repos/payments.repo";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountRub: z.coerce
    .number()
    .int()
    .min(MIN_TOPUP_RUB)
    .max(MAX_TOPUP_RUB),
});

export async function POST(request: Request) {
  const user = await requireUser();

  if (!isYookassaConfigured()) {
    return Response.json(
      { error: "ЮKassa не настроена администратором" },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Некорректная сумма" }, { status: 400 });
  }

  const amountKopecks = rubToKopecks(parsed.amountRub);
  const description = `Пополнение баланса Fitness SaaS на ${parsed.amountRub} ₽`;

  // 1. Создаём pending запись в нашей БД (получаем internal id)
  const { id: internalId } = await createPaymentRecord({
    userId: user.id,
    amountKopecks,
    description,
    metadata: { source: "topup" },
  });

  // 2. Зовём ЮKassa с idempotence-key=internalId — если повторно вызовут,
  //    ЮKassa вернёт тот же платёж.
  let yoo;
  try {
    yoo = await createYooPayment({
      amountKopecks,
      description,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=${internalId}`,
      metadata: {
        internalId,
        userId: user.id,
      },
      idempotenceKey: internalId,
    });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "ЮKassa createPayment failed",
      },
      { status: 502 },
    );
  }

  await attachProviderPaymentId(internalId, yoo.id, yoo.status, yoo);

  const confirmationUrl = yoo.confirmation?.confirmation_url;
  if (!confirmationUrl) {
    return Response.json(
      { error: "ЮKassa не вернула confirmation_url" },
      { status: 502 },
    );
  }

  return Response.json({
    confirmationUrl,
    internalId,
  });
}
