import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createHash } from "node:crypto";
import type { Adapter } from "next-auth/adapters";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { cookies } from "next/headers";
import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

import { authConfig } from "./config";
import { sendOtpEmail } from "./email";
import { otpReservationKey } from "./otp-reservation";
import {
  createRefreshToken,
  REFRESH_COOKIE_NAME,
  REFRESH_MAX_AGE_SECONDS,
  revokeRefreshToken,
} from "./refresh";

const OTP_MAX_AGE_SECONDS = 10 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_ATTEMPT_PREFIX = "fitness-otp-attempt:";
const OTP_RESERVATION_PREFIX = "fitness-otp-reservation:";
const pendingOtpReservations = new Map<string, Promise<void>>();

/** Криптостойкий 6-значный OTP. Генерируется на каждый login-attempt и
 *  хранится в verification_tokens (Auth.js встроенная таблица). */
function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // 100000-999999 (6 цифр)
  const code = 100000 + (buf[0]! % 900000);
  return String(code);
}

/** Auth.js принимает provider endpoints напрямую, поэтому защита должна жить
 * в adapter, а не только в server action формы. Advisory lock сериализует
 * запросы для одного identifier на всех Node-инстансах. */
const authAdapter: Adapter = {
  ...DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  async createVerificationToken(data) {
    // Auth.js запускает sendVerificationRequest и createVerificationToken
    // параллельно. Для одного process ждём delivery целиком: при mail error
    // код не должен осесть в БД без письма. Между process сериализация
    // обеспечивается advisory lock ниже.
    await pendingOtpReservations.get(
      otpReservationKey(data.identifier, data.token),
    );

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${data.identifier}))`,
      );

      const existing = await tx
        .select({
          token: schema.verificationTokens.token,
          expires: schema.verificationTokens.expires,
        })
        .from(schema.verificationTokens)
        .where(eq(schema.verificationTokens.identifier, data.identifier))
        .orderBy(desc(schema.verificationTokens.expires));
      const issuanceRecords = existing.filter(
        (entry) => !entry.token.startsWith(OTP_ATTEMPT_PREFIX),
      );
      const matchingReservation = issuanceRecords.some(
        (entry) => entry.token === `${OTP_RESERVATION_PREFIX}${data.token}`,
      );
      const [latest] = issuanceRecords;

      // `expires` выдаётся Auth.js как now + maxAge. Пока остаётся больше
      // девяти минут, предыдущая отправка была менее минуты назад.
      if (
        !matchingReservation &&
        latest &&
        latest.expires.getTime() >
          Date.now() +
            (OTP_MAX_AGE_SECONDS - OTP_RESEND_COOLDOWN_SECONDS) * 1000
      ) {
        throw new Error("OTP_RATE_LIMITED");
      }

      // Повторная отправка заменяет код, а не создаёт параллельные действующие
      // OTP. Заодно удаляем маркеры неудачных попыток прошлой выдачи.
      await tx
        .delete(schema.verificationTokens)
        .where(eq(schema.verificationTokens.identifier, data.identifier));

      const [created] = await tx
        .insert(schema.verificationTokens)
        .values(data)
        .returning();
      return created ?? null;
    });
  },
  async useVerificationToken(params) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${params.identifier}))`,
      );

      const active = await tx
        .select({ token: schema.verificationTokens.token })
        .from(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, params.identifier),
            gt(schema.verificationTokens.expires, new Date()),
          ),
        );
      const failedAttempts = active.filter((entry) =>
        entry.token.startsWith(OTP_ATTEMPT_PREFIX),
      ).length;
      const hasActiveOtp = active.some(
        (entry) =>
          !entry.token.startsWith(OTP_ATTEMPT_PREFIX) &&
          !entry.token.startsWith(OTP_RESERVATION_PREFIX),
      );

      // Callback можно вызвать напрямую без выдачи кода. Не создаём attempt
      // markers в этом случае, иначе атакующий сможет блокировать чужой email
      // бессмысленными запросами раз в минуту.
      if (!hasActiveOtp) return null;

      // Шестая попытка сжигает OTP: перебор не даёт бесконечного числа догадок
      // и не сообщает, существовал ли у этого email действующий код.
      if (failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
        await tx
          .delete(schema.verificationTokens)
          .where(eq(schema.verificationTokens.identifier, params.identifier));
        return null;
      }

      const [used] = await tx
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, params.identifier),
            eq(schema.verificationTokens.token, params.token),
          ),
        )
        .returning();

      if (used) {
        // Успешный код одноразовый; очистка attempt markers не оставляет
        // состояние для следующего входа.
        await tx
          .delete(schema.verificationTokens)
          .where(eq(schema.verificationTokens.identifier, params.identifier));
        return used;
      }

      await tx.insert(schema.verificationTokens).values({
        identifier: params.identifier,
        token: `${OTP_ATTEMPT_PREFIX}${crypto.randomUUID()}`,
        expires: new Date(Date.now() + OTP_MAX_AGE_SECONDS * 1000),
      });
      return null;
    });
  },
};

/** Консервативный ASCII-only identifier устраняет Unicode normalization
 * ambiguity до обновления Auth.js и применяется к прямым provider routes. */
function normalizeEmailIdentifier(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  if (
    !/^[\x21-\x7e]+$/.test(normalized) ||
    normalized.includes("..") ||
    normalized.split("@").length !== 2
  ) {
    throw new Error("Invalid email identifier");
  }
  return normalized;
}

function verificationTokenHash(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`${token}${secret}`).digest("hex");
}

/** Reserve выполняется ДО mail provider. Так даже прямой Auth.js endpoint
 * получает одинаковый cooldown, не раскрывая существование аккаунта. */
async function reserveOtpDelivery(
  identifier: string,
  tokenHash: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`,
    );
    const existing = await tx
      .select({
        token: schema.verificationTokens.token,
        expires: schema.verificationTokens.expires,
      })
      .from(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, identifier))
      .orderBy(desc(schema.verificationTokens.expires));
    const [latest] = existing.filter(
      (entry) => !entry.token.startsWith(OTP_ATTEMPT_PREFIX),
    );

    if (
      latest &&
      latest.expires.getTime() >
        Date.now() +
          (OTP_MAX_AGE_SECONDS - OTP_RESEND_COOLDOWN_SECONDS) * 1000
    ) {
      throw new Error("OTP_RATE_LIMITED");
    }

    await tx
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, identifier));
    await tx.insert(schema.verificationTokens).values({
      identifier,
      token: `${OTP_RESERVATION_PREFIX}${tokenHash}`,
      expires: new Date(Date.now() + OTP_MAX_AGE_SECONDS * 1000),
    });
  });
}

async function removeFailedOtpReservation(
  identifier: string,
  token: string,
): Promise<void> {
  await db
    .delete(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.identifier, identifier),
        eq(
          schema.verificationTokens.token,
          `${OTP_RESERVATION_PREFIX}${verificationTokenHash(token)}`,
        ),
      ),
    );
}

async function sendRateLimitedOtpEmail(
  params: Parameters<typeof sendOtpEmail>[0],
): Promise<void> {
  const tokenHash = verificationTokenHash(params.token);
  const reservationKey = otpReservationKey(params.identifier, tokenHash);
  const reservation = reserveOtpDelivery(params.identifier, tokenHash);
  const delivery = reservation.then(() => sendOtpEmail(params));
  pendingOtpReservations.set(reservationKey, delivery);

  try {
    await delivery;
  } catch (error) {
    // Если provider не принял письмо, не оставляем бессмысленный действующий
    // код/резервацию и не заставляем пользователя ждать cooldown.
    await removeFailedOtpReservation(params.identifier, params.token);
    throw error;
  } finally {
    if (pendingOtpReservations.get(reservationKey) === delivery) {
      pendingOtpReservations.delete(reservationKey);
    }
  }
}

export const { auth, signIn, signOut, handlers, unstable_update } = NextAuth({
  ...authConfig,
  adapter: authAdapter,
  providers: [
    Resend({
      from: process.env.EMAIL_FROM,
      maxAge: OTP_MAX_AGE_SECONDS,
      generateVerificationToken: async () => generateSixDigitOtp(),
      sendVerificationRequest: sendRateLimitedOtpEmail,
      normalizeIdentifier: normalizeEmailIdentifier,
    }),
  ],
  events: {
    /** После успешного логина выпускаем долгоживущий refresh-cookie.
     *  Если основной session-cookie теряется (iOS PWA suspend) —
     *  proxy.ts сменяет refresh на новый session через /api/auth/restore. */
    async signIn({ user }) {
      if (!user?.id) return;
      const refresh = await createRefreshToken(user.id);
      const cookieStore = await cookies();
      cookieStore.set({
        name: REFRESH_COOKIE_NAME,
        value: refresh,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: REFRESH_MAX_AGE_SECONDS,
      });
    },
    async signOut() {
      const cookieStore = await cookies();
      const refresh = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
      if (refresh) await revokeRefreshToken(refresh);
      cookieStore.delete(REFRESH_COOKIE_NAME);
    },
  },
});
