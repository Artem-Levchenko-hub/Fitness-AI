import { requireUser } from "@/lib/auth/require-user";
import { pushSubscriptionSchema } from "@/lib/push/subscription-input";
import {
  PushEndpointOwnershipError,
  PushSubscriptionLimitError,
  subscribeUser,
} from "@/lib/repos/push.repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  let parsed;
  try {
    parsed = pushSubscriptionSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent");
  try {
    const row = await subscribeUser(user.id, {
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent,
    });
    return Response.json({ ok: true, id: row.id });
  } catch (error) {
    if (error instanceof PushSubscriptionLimitError) {
      return Response.json({ error: "Too many devices" }, { status: 429 });
    }
    if (error instanceof PushEndpointOwnershipError) {
      return Response.json({ error: "Invalid subscription" }, { status: 409 });
    }
    throw error;
  }
}
