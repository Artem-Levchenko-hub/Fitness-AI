import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

import { authConfig } from "./config";
import { sendMagicLinkEmail } from "./email";

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
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
});
