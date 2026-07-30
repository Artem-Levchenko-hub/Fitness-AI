import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  requestUnusedTopupRefund,
  RefundUnavailableError,
} from "@/lib/billing/refunds";
import { YookassaApiError } from "@/lib/billing/yookassa";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  const { id } = await context.params;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "refund_reason_required" }, { status: 400 });
  }

  try {
    const result = await requestUnusedTopupRefund({
      paymentId: id,
      adminUserId: admin.id,
      reason: body.data.reason,
    });
    return Response.json(result, {
      status: result.status === "refund_pending" ? 202 : 200,
    });
  } catch (error) {
    if (error instanceof RefundUnavailableError) {
      const conflictReasons = new Set([
        "payment_not_refundable",
        "credited_funds_already_used",
        "status_pending",
        "status_canceled",
      ]);
      return Response.json(
        { error: error.reason },
        {
          status:
            error.reason === "payment_not_found"
              ? 404
              : conflictReasons.has(error.reason)
                ? 409
                : 422,
        },
      );
    }
    if (error instanceof YookassaApiError) {
      return Response.json(
        { error: "provider_unavailable" },
        { status: 503 },
      );
    }
    console.error("[admin-refund] failed", { paymentId: id });
    return Response.json({ error: "refund_failed" }, { status: 503 });
  }
}
