import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { getAppOrigin } from "@/lib/app-origin";
import { authConfig, REFRESH_COOKIE_NAME } from "@/lib/auth/config";

const PROTECTED_PREFIXES = [
  "/admin",
  "/billing",
  "/body",
  "/cardio",
  "/circuits",
  "/create",
  "/dashboard",
  "/exercises",
  "/friends",
  "/library",
  "/notes",
  "/nutrition",
  "/profile",
  "/programs",
  "/schedule",
  "/settings",
  "/sleep",
  "/stats",
  "/templates",
  "/workouts",
];

const { auth } = NextAuth(authConfig);

type Csp = { value: string; requestHeaders: Headers };

function createCsp(headers: Headers): Csp {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  // Sonner 2.0.7 создаёт сначала пустой <style>, затем заполняет его своей
  // статичной таблицей. Разрешаем ровно эти два содержимых, не весь inline CSS.
  const value = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""};
    style-src-elem 'self' 'nonce-${nonce}' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY=';
    style-src-attr 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self';
    worker-src 'self' blob:;
    manifest-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", value);
  return { value, requestHeaders };
}

function withCsp(response: NextResponse, csp: Csp): NextResponse {
  response.headers.set("Content-Security-Policy", csp.value);
  return response;
}

export default auth((req) => {
  const csp = createCsp(req.headers);
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !req.auth) {
    const returnPath = `${pathname}${req.nextUrl.search}`;
    if (req.cookies.has(REFRESH_COOKIE_NAME)) {
      const restoreUrl = new URL("/api/auth/restore", getAppOrigin());
      restoreUrl.searchParams.set("next", returnPath);
      return withCsp(NextResponse.redirect(restoreUrl), csp);
    }

    const loginUrl = new URL("/login", getAppOrigin());
    loginUrl.searchParams.set("callbackUrl", returnPath);
    return withCsp(NextResponse.redirect(loginUrl), csp);
  }

  return withCsp(
    NextResponse.next({ request: { headers: csp.requestHeaders } }),
    csp,
  );
});

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
