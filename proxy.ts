import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";
import { REFRESH_COOKIE_NAME } from "@/lib/auth/refresh";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/workouts",
  "/exercises",
  "/templates",
  "/notes",
  "/stats",
  "/profile",
  "/settings",
  "/upgrade",
];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthed = !!req.auth;
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !isAuthed) {
    // На iOS PWA после suspend session-cookie может пропасть, но
    // долгоживущий refresh-cookie часто переживает. Если он есть —
    // отправляем на /api/auth/restore: оно подменит refresh на свежий
    // session и редиректнет назад. Пользователь видит лишь короткий flash.
    const hasRefresh = req.cookies.has(REFRESH_COOKIE_NAME);
    if (hasRefresh) {
      const restoreUrl = new URL("/api/auth/restore", req.url);
      restoreUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(restoreUrl);
    }

    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Не редиректим /login → /dashboard:
  // - edge `auth()` без adapter может возвращать ложно-truthy session
  //   и создать цикл /login → /dashboard → /login.
  // - залогиненный пользователь, попавший на /login, просто увидит форму.

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
};
