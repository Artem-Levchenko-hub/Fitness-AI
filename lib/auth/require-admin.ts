import { notFound } from "next/navigation";

import { isUserAdmin } from "@/lib/repos/admin.repo";

import { requireUser, type AuthUser } from "./require-user";

/** Server-side гейт админ-страниц: залогинен И users.is_admin. Не-админу
 *  отдаём 404 (а не 403) — не раскрываем существование раздела. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (!(await isUserAdmin(user.id))) notFound();
  return user;
}
