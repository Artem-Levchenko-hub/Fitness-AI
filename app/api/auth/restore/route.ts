import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getAppOrigin } from "@/lib/app-origin";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_MAX_AGE_SECONDS,
  rotateRefreshToken,
} from "@/lib/auth/refresh";

const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const SESSION_COOKIE = "authjs.session-token";

/** Возвращает свежий session-cookie только по HttpOnly refresh-cookie. Каждый
 * restore атомарно ротирует opaque token в БД, поэтому украденная старая копия
 * не переживает первое же законное восстановление. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = sanitizeNext(url.searchParams.get("next"));

  const cookieStore = await cookies();
  const refreshValue = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshValue) {
    return redirectToLogin(req, next);
  }

  const refresh = await rotateRefreshToken(refreshValue);
  if (!refresh) {
    // Не отправляем Set-Cookie delete: два параллельных restore могут предъявить
    // один старый token. Первый атомарно ротирует его, а запоздавший ответ второго
    // не должен стереть уже выданную successor-cookie. Невалидный opaque token
    // всё равно ничего не авторизует и будет заменён при следующем входе.
    return redirectToLogin(req, next);
  }

  const sessionToken = await issueSessionToken(refresh.userId);
  if (!sessionToken) {
    const res = redirectToLogin(req, next);
    res.cookies.delete(REFRESH_COOKIE_NAME);
    return res;
  }

  const response = NextResponse.redirect(new URL(next, getAppOrigin()));
  setSessionCookie(response, sessionToken);
  setRefreshCookie(response, refresh.token);
  return response;
}

export async function POST() {
  // Раньше этот маршрут принимал bearer из localStorage/IndexedDB. Оставляем
  // явный 405 вместо silent fallback, чтобы старые клиенты не могли вернуть
  // небезопасный канал хранения токена.
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } },
  );
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

function setRefreshCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  // защита от open redirect: только относительные пути на свой origin
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function redirectToLogin(req: Request, next: string) {
  const url = new URL("/login", getAppOrigin());
  if (next && next !== "/dashboard") url.searchParams.set("callbackUrl", next);
  return NextResponse.redirect(url);
}
