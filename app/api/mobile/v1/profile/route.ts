import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { getUserProfile, updateUserProfile } from "@/lib/repos/body.repo";
import { profileSchema } from "@/server/schemas/body";

const headers = { "Cache-Control": "private, no-store" };
const requestSchema = z.object({
  accountId: z.string().min(1).max(128),
  profile: profileSchema.extend({
    birthDate: z.union([z.iso.date(), z.literal("")]).transform((date) => date ? new Date(date) : null),
    timezone: z.string().min(1).max(100).refine((timezone) => {
      try {
        new Intl.DateTimeFormat("ru", { timeZone: timezone });
        return true;
      } catch {
        return false;
      }
    }),
  }),
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const profile = await getUserProfile(user.id);
  if (!profile) return json({ error: "profile_not_found" }, 404);
  return json({ profile });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return json({ error: "invalid_content_type" }, 415);
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_profile" }, 400);
  if (parsed.data.accountId !== user.id) return json({ error: "account_changed" }, 409);
  await updateUserProfile(user.id, parsed.data.profile);
  revalidatePath("/settings");
  revalidatePath("/stats");
  return json({ ok: true });
}
