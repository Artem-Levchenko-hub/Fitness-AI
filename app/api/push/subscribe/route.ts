import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { subscribeUser } from "@/lib/repos/push.repo";

export const runtime = "nodejs";

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const user = await requireUser();
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const userAgent = req.headers.get("user-agent");
  const row = await subscribeUser(user.id, {
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    userAgent,
  });
  return Response.json({ ok: true, id: row.id });
}
