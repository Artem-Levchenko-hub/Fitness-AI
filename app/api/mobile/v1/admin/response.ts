import { getUser } from "@/lib/auth/require-user";
import { isUserAdmin } from "@/lib/repos/admin.repo";

export function adminJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function adminRead(load: (adminId: string) => Promise<Response>) {
  try {
    const user = await getUser();
    if (!user) return adminJson({ error: "sign_in_required" }, 401);
    if (!(await isUserAdmin(user.id))) return adminJson({ error: "not_found" }, 404);
    return await load(user.id);
  } catch {
    return adminJson({ error: "admin_unavailable" }, 503);
  }
}
