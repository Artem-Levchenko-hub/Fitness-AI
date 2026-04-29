import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/workouts",
  "/exercises",
  "/templates",
  "/notes",
  "/stats",
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
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
};
