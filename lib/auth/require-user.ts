import { redirect } from "next/navigation";
import { cache } from "react";

import { getUserProfile } from "@/lib/repos/body.repo";

import { auth } from "./index";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

/** Server-side: убедиться что юзер залогинен.
 *  Возвращает user или редирект на /login. Использовать в Server Components
 *  и Server Actions внутри (app)/ группы. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** Возвращает user или null (без редиректа). Для маркетинговых страниц,
 *  которые меняют CTA в зависимости от авторизации. */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  // JWTs live for 90 days. Read the current name so edits and clearing it
  // reach every server-rendered display without waiting for another sign-in.
  const profile = await getUserProfile(session.user.id);
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    image: session.user.image ?? null,
  };
});
