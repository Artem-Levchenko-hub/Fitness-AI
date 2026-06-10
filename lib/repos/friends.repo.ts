import { and, eq, or } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

/** Доступ к дружбам. R-7: каждая функция принимает userId действующего
 *  пользователя и фильтрует так, что юзер видит/меняет только свои связи. */

/** Отправить заявку в друзья userId → addresseeId.
 *  - Запрет самому себе (бессмысленно) → бросаем.
 *  - Идемпотентно: повтор той же заявки (тот же requester→addressee) ничего
 *    не создаёт (onConflictDoNothing по UNIQUE). Встречную заявку (когда
 *    addressee уже отправлял нам) НЕ создаём дублем — сразу принимаем её,
 *    чтобы не плодить две pending-строки на одну пару. */
export async function sendFriendRequest(
  userId: string,
  addresseeId: string,
): Promise<void> {
  if (userId === addresseeId) {
    throw new Error("Нельзя добавить в друзья самого себя");
  }

  // Есть ли встречная заявка addressee → userId? Если да — принимаем её.
  const [incoming] = await db
    .select({ id: schema.friendships.id })
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.requesterId, addresseeId),
        eq(schema.friendships.addresseeId, userId),
        eq(schema.friendships.status, "pending"),
      ),
    )
    .limit(1);

  if (incoming) {
    await db
      .update(schema.friendships)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(schema.friendships.id, incoming.id));
    return;
  }

  await db
    .insert(schema.friendships)
    .values({ requesterId: userId, addresseeId })
    .onConflictDoNothing({
      target: [schema.friendships.requesterId, schema.friendships.addresseeId],
    });
}

/** Принять входящую заявку. Только адресат своей pending-заявки может принять
 *  (R-7: фильтр addresseeId === userId). Возвращает true, если что-то приняли. */
export async function acceptFriendRequest(
  userId: string,
  friendshipId: string,
): Promise<boolean> {
  const updated = await db
    .update(schema.friendships)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(
      and(
        eq(schema.friendships.id, friendshipId),
        eq(schema.friendships.addresseeId, userId),
        eq(schema.friendships.status, "pending"),
      ),
    )
    .returning({ id: schema.friendships.id });
  return updated.length > 0;
}

/** Принятые дружбы юзера — он может быть на любой стороне (requester ИЛИ
 *  addressee). R-7: одна из сторон обязательно === userId. */
export async function listFriends(
  userId: string,
): Promise<schema.Friendship[]> {
  return db
    .select()
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.status, "accepted"),
        or(
          eq(schema.friendships.requesterId, userId),
          eq(schema.friendships.addresseeId, userId),
        ),
      ),
    );
}

/** Входящие заявки (нам ещё не ответили) — где мы адресат. R-7. */
export async function listIncomingRequests(
  userId: string,
): Promise<schema.Friendship[]> {
  return db
    .select()
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.addresseeId, userId),
        eq(schema.friendships.status, "pending"),
      ),
    );
}

/** Исходящие заявки (мы отправили, ждём ответа) — где мы отправитель. R-7. */
export async function listOutgoingRequests(
  userId: string,
): Promise<schema.Friendship[]> {
  return db
    .select()
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.requesterId, userId),
        eq(schema.friendships.status, "pending"),
      ),
    );
}
