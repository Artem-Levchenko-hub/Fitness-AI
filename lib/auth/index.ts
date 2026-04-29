import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

import { authConfig } from "./config";
import { sendOtpEmail } from "./email";

/** Криптостойкий 6-значный OTP. Генерируется на каждый login-attempt и
 *  хранится в verification_tokens (Auth.js встроенная таблица). */
function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // 100000-999999 (6 цифр)
  const code = 100000 + (buf[0]! % 900000);
  return String(code);
}

export const { auth, signIn, signOut, handlers, unstable_update } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Resend({
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 минут — короче magic-link дефолта
      generateVerificationToken: async () => generateSixDigitOtp(),
      sendVerificationRequest: sendOtpEmail,
    }),
  ],
});
