import type { NextAuthConfig } from "next-auth";

const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;
const ONE_DAY_SECONDS = 60 * 60 * 24;

/** HttpOnly refresh-cookie живёт заметно меньше основной сессии и всегда
 * ротируется на восстановлении. Константы лежат в edge-safe модуле, потому что
 * proxy.ts должен видеть только имя cookie, не импортируя DB-код. */
export const REFRESH_COOKIE_NAME = "fitness-refresh-token";
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Edge-safe Auth.js конфиг — без БД-адаптера и без Resend SDK.
 *  Используется в `proxy.ts` (Edge runtime) и расширяется в `lib/auth/index.ts`
 *  для Node runtime (там добавляются adapter и providers).
 *
 *  Session strategy = "jwt" — обязательно, чтобы edge `proxy.ts` мог
 *  валидировать сессию без БД-адаптера. Drizzle-адаптер при этом
 *  остаётся для users/accounts/verificationTokens (нужно Resend OTP). */
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: NINETY_DAYS_SECONDS,
    updateAge: ONE_DAY_SECONDS,
  },
  cookies: {
    /** Намеренно без `__Secure-` префикса: на iOS Safari standalone (PWA с
     *  домашнего экрана) cookies с этим префиксом нестабильно сохраняются
     *  между приостановкой и возобновлением приложения. secure+httpOnly
     *  обеспечивают эквивалентную защиту на проде (HTTPS-only трафик). */
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: NINETY_DAYS_SECONDS,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
