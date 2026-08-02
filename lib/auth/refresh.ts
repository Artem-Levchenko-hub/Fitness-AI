import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";

import {
  REFRESH_COOKIE_NAME,
  REFRESH_MAX_AGE_SECONDS,
} from "./config";

export { REFRESH_COOKIE_NAME, REFRESH_MAX_AGE_SECONDS };

/**
 * Opaque refresh-token хранится только в HttpOnly cookie. В БД попадает лишь
 * SHA-256, поэтому утечка базы не становится готовой сессией. Удаление записи
 * немедленно отзывает токен, а restore меняет его одноразово.
 */
const REFRESH_PREFIX = "fitness-refresh:";

function tokenKey(token: string): string {
  return `${REFRESH_PREFIX}${createHash("sha256").update(token).digest("hex")}`;
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    sessionToken: tokenKey(token),
    userId,
    expires: expiresAt(),
  });
  return token;
}

export async function verifyRefreshToken(
  token: string,
): Promise<string | null> {
  const [stored] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(
      and(
        eq(sessions.sessionToken, tokenKey(token)),
        gt(sessions.expires, new Date()),
      ),
    )
    .limit(1);
  return stored?.userId ?? null;
}

/** Атомарно отзывает предъявленный токен и создаёт следующий. Повторное
 * предъявление старого токена уже не работает даже при параллельных запросах. */
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; token: string } | null> {
  return db.transaction(async (tx) => {
    const [stored] = await tx
      .delete(sessions)
      .where(
        and(
          eq(sessions.sessionToken, tokenKey(token)),
          gt(sessions.expires, new Date()),
        ),
      )
      .returning({ userId: sessions.userId });
    if (!stored) return null;

    const nextToken = randomBytes(32).toString("base64url");
    await tx.insert(sessions).values({
      sessionToken: tokenKey(nextToken),
      userId: stored.userId,
      expires: expiresAt(),
    });
    return { userId: stored.userId, token: nextToken };
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .delete(sessions)
    .where(eq(sessions.sessionToken, tokenKey(token)));
}

function expiresAt(): Date {
  return new Date(Date.now() + REFRESH_MAX_AGE_SECONDS * 1000);
}
