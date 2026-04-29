import type { NextAuthConfig } from "next-auth";

/** Edge-safe Auth.js конфиг — без БД-адаптера и без Resend SDK.
 *  Используется в `proxy.ts` (Edge runtime) и расширяется в `lib/auth/index.ts`
 *  для Node runtime (там добавляются adapter и providers). */
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  session: { strategy: "database" },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig;
