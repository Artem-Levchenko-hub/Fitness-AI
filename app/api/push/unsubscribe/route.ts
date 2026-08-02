import { requireUser } from "@/lib/auth/require-user";
import { pushEndpointSchema } from "@/lib/push/subscription-input";
import { unsubscribeByEndpoint } from "@/lib/repos/push.repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  let parsed;
  try {
    parsed = pushEndpointSchema.parse(
      (await req.json())?.endpoint,
    );
  } catch {
    return Response.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  await unsubscribeByEndpoint(user.id, parsed);
  return Response.json({ ok: true });
}
