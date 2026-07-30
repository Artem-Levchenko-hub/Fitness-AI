import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { getBillingReadiness } from "@/lib/billing/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await db.execute(sql`select 1`);
    const billing = getBillingReadiness();
    return Response.json(
      {
        ok: true,
        database: "up",
        billing: {
          mode: billing.mode,
          paymentsReady: billing.paymentsEnabled,
          subscriptionsReady: billing.subscriptionsEnabled,
        },
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        database: "down",
        checkedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
