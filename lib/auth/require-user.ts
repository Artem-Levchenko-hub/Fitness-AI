import { redirect } from "next/navigation";

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
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

/** Возвращает user или null (без редиректа). Для маркетинговых страниц,
 *  которые меняют CTA в зависимости от авторизации. */
export async function getUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}
