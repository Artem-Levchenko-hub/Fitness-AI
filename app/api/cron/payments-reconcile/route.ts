import { reconcileYooPayment } from "@/lib/billing/settlement";
import { listRecoverablePayments } from "@/lib/repos/payments.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const payments = await listRecoverablePayments(25);
  const results: Array<{
    id: string;
    ok: boolean;
    status?: string;
    error?: string;
  }> = [];

  for (const payment of payments) {
    if (!payment.providerPaymentId) continue;
    try {
      const result = await reconcileYooPayment(payment);
      results.push({
        id: payment.id,
        ok: true,
        status: result.status,
      });
    } catch {
      // Следующий hourly tick повторит сверку. Ни provider body, ни PII в лог
      // и ответ не попадают.
      results.push({
        id: payment.id,
        ok: false,
        error: "reconcile_failed",
      });
    }
  }

  return Response.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}
