import { requireUser } from "@/lib/auth/require-user";
import {
  PaymentVerificationError,
  reconcileYooPayment,
} from "@/lib/billing/settlement";
import { YookassaApiError } from "@/lib/billing/yookassa";
import { getPaymentForUser } from "@/lib/repos/payments.repo";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;
  const payment = await getPaymentForUser(user.id, id);

  if (!payment) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const result = await reconcileYooPayment(payment);
    return Response.json({
      id: payment.id,
      kind: payment.kind,
      status: result.status,
      amountKopecks: payment.amountKopecks,
      balanceAfterKopecks: result.balanceAfterKopecks,
      subscriptionPeriodEnd: result.subscriptionPeriodEnd?.toISOString(),
    });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return Response.json({ error: "payment_mismatch" }, { status: 409 });
    }
    if (error instanceof YookassaApiError) {
      return Response.json(
        { error: "provider_unavailable" },
        { status: 503 },
      );
    }
    console.error("[payment-reconcile] failed", { paymentId: payment.id });
    return Response.json({ error: "reconcile_failed" }, { status: 503 });
  }
}
