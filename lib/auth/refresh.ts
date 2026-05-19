import { decode, encode } from "next-auth/jwt";

/** Долгоживущий refresh-токен. Идея: основной session-cookie живёт 90 дней,
 *  но iOS Safari в standalone-режиме может терять его при возврате PWA из
 *  фона. Параллельный refresh-cookie живёт год, имеет другое имя/срок и
 *  обычно переживает суспенд. Когда proxy.ts видит «нет session, но есть
 *  refresh» — он редиректит на /api/auth/restore, который меняет refresh
 *  на свежий session-cookie без участия пользователя. */

export const REFRESH_COOKIE_NAME = "fitness-refresh-token";
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
const REFRESH_SALT = "fitness.refresh-token";

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export async function createRefreshToken(userId: string): Promise<string> {
  return await encode({
    token: { uid: userId },
    secret: getSecret(),
    salt: REFRESH_SALT,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export async function verifyRefreshToken(
  token: string,
): Promise<string | null> {
  try {
    const decoded = await decode({
      token,
      secret: getSecret(),
      salt: REFRESH_SALT,
    });
    if (decoded && typeof decoded.uid === "string") return decoded.uid;
    return null;
  } catch {
    return null;
  }
}
