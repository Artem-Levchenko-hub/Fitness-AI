import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import {
  REFRESH_COOKIE_NAME,
  verifyRefreshToken,
} from "@/lib/auth/refresh";

const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const SESSION_COOKIE = "authjs.session-token";

/** Возвращает свежий session-cookie по любому действующему refresh-токену.
 *  Используется в двух режимах:
 *  - GET — proxy.ts заворачивает сюда, когда видит refresh-cookie
 *    (для браузеров где cookies стабильны).
 *  - POST {token} — клиент с /login отправляет refresh из localStorage
 *    (для iOS PWA, где cookies теряются при suspend). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = sanitizeNext(url.searchParams.get("next"));

  const cookieStore = await cookies();
  const refreshValue = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshValue) {
    return redirectToLogin(req, next);
  }

  const userId = await verifyRefreshToken(refreshValue);
  if (!userId) {
    const res = redirectToLogin(req, next);
    res.cookies.delete(REFRESH_COOKIE_NAME);
    return res;
  }

  const sessionToken = await issueSessionToken(userId);
  if (!sessionToken) {
    const res = redirectToLogin(req, next);
    res.cookies.delete(REFRESH_COOKIE_NAME);
    return res;
  }

  const response = NextResponse.redirect(new URL(next, req.url));
  setSessionCookie(response, sessionToken);
  return response;
}

export async function POST(req: Request) {
  let token: string | null = null;
  try {
    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const userId = await verifyRefreshToken(token);
  if (!userId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const sessionToken = await issueSessionToken(userId);
  if (!sessionToken) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, sessionToken);
  return response;
}

async function issueSessionToken(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  return await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret: process.env.AUTH_SECRET!,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  });
}

function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });
}

function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  // защита от open redirect: только относительные пути на свой origin
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function redirectToLogin(req: Request, next: string) {
  const url = new URL("/login", req.url);
  if (next && next !== "/dashboard") url.searchParams.set("callbackUrl", next);
  return NextResponse.redirect(url);
}
