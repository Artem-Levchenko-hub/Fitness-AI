import {
  failAndRefundAiBillingOperation,
  listStaleAiBillingOperations,
} from "@/lib/repos/ai-billing.repo";
import { releaseStaleAiCapacity } from "@/lib/ai/guard";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // AI route timeout = 45s. Даём большой запас на onFinish и только затем
  // считаем processing-операцию оборванной.
  const cutoff = new Date(Date.now() - 5 * 60_000);
  const releasedCapacity = await releaseStaleAiCapacity(cutoff);
  const stale = await listStaleAiBillingOperations(cutoff);
  let refunded = 0;
  for (const operation of stale) {
    if (
      await failAndRefundAiBillingOperation(
        operation.id,
        "stale_processing_recovered",
      )
    ) {
      refunded += 1;
    }
  }
  return Response.json({
    checked: stale.length,
    refunded,
    releasedCapacity,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
