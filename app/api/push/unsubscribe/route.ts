import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { unsubscribeByEndpoint } from "@/lib/repos/push.repo";

export const runtime = "nodejs";

const bodySchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: Request) {
  await requireUser();
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  await unsubscribeByEndpoint(parsed.endpoint);
  return Response.json({ ok: true });
}
