import { requireUser } from "@/lib/auth/require-user";
import { resumeSubscription } from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireUser();
  const resumed = await resumeSubscription(user.id);
  if (!resumed) {
    return Response.json(
      { error: "subscription_cannot_be_resumed" },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, cancelAtPeriodEnd: false });
}
