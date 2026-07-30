import { requireUser } from "@/lib/auth/require-user";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  const canceled = await cancelSubscriptionAtPeriodEnd(user.id);
  if (!canceled) {
    return Response.json({ error: "active_subscription_not_found" }, { status: 404 });
  }
  return Response.json({ ok: true, cancelAtPeriodEnd: true });
}
