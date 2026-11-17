import { z } from "zod";

import { getUser, type AuthUser } from "@/lib/auth/require-user";

export const accountIdSchema = z.string().min(1).max(128);
export const entityIdSchema = z.string().min(1).max(128);

export function companionJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function withCompanionUser(load: (user: AuthUser) => Promise<Response>) {
  try {
    const user = await getUser();
    if (!user) return companionJson({ error: "sign_in_required" }, 401);
    return await load(user);
  } catch {
    return companionJson({ error: "companion_unavailable" }, 503);
  }
}

export function companionMutation<T extends { accountId: string }>(
  request: Request,
  schema: z.ZodType<T>,
  apply: (user: AuthUser, input: T) => Promise<Response>,
) {
  return withCompanionUser(async (user) => {
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") return companionJson({ error: "invalid_content_type" }, 415);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return companionJson({ error: "invalid_input" }, 400);
    if (parsed.data.accountId !== user.id) return companionJson({ error: "account_changed" }, 409);
    return apply(user, parsed.data);
  });
}
