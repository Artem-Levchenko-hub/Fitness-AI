import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  selectLastEvent,
  sortFriendsByRecency,
} from "@/lib/domain/friends/friend-activity";
import type { HistoryItem } from "@/lib/domain/workouts/history";
import { isUserAdmin } from "@/lib/repos/admin.repo";
import { getLatestMeasurement } from "@/lib/repos/body.repo";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listRecentWorkouts } from "@/lib/repos/workouts.repo";

/** Публичная карточка друга/заявителя — минимум для UI (без приватных полей). */
export type FriendUser = { id: string; name: string | null; email: string };

/** Карточка друга для его страницы — публичные поля + рост/последний вес,
 *  показываемые read-only только подтверждённому другу (R-7, см.
 *  getFriendProfile). heightCm — с профиля (users), weightKg — из последнего
 *  замера тела; любое может быть null. sharesPrograms — включил ли друг тумблер
 *  «делиться программами»: открывает его шаблоны/программы + оценки ИИ-тренера. */
export type FriendProfile = FriendUser & {
  heightCm: number | null;
  weightKg: number | null;
  sharesPrograms: boolean;
};

/** Дружба/заявка вместе с «другим» пользователем (партнёром по связи). */
export type FriendshipWithUser = {
  friendshipId: string;
  createdAt: Date;
  user: FriendUser;
};

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

/** Найти пользователя по (уже нормализованному) email — для добавления в друзья
 *  по адресу. Возвращает только публичные поля. */
export async function findUserByEmail(
  email: string,
): Promise<FriendUser | null> {
  const [u] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return u ?? null;
}

/** Являются ли userId и otherId принятыми друзьями (в любом направлении)?
 *  R-7: одна из сторон обязательно === userId — гейт для просмотра чужого
 *  профиля/тренировок. Себя другом не считаем. */
export async function areFriends(
  userId: string,
  otherId: string,
): Promise<boolean> {
  if (userId === otherId) return false;
  const [row] = await db
    .select({ id: schema.friendships.id })
    .from(schema.friendships)
    .where(
      and(
        eq(schema.friendships.status, "accepted"),
        or(
          and(
            eq(schema.friendships.requesterId, userId),
            eq(schema.friendships.addresseeId, otherId),
          ),
          and(
            eq(schema.friendships.requesterId, otherId),
            eq(schema.friendships.addresseeId, userId),
          ),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Публичная карточка друга — ТОЛЬКО если otherId является принятым другом
 *  userId. Иначе null. Единый R-7-гейт: чужие данные смотрим лишь по дружбе.
 *  Возвращает рост (с профиля) + вес последнего замера — read-only для шапки
 *  страницы друга; reuse getLatestMeasurement (R-04).
 *
 *  Админ-обход: админ (users.is_admin) видит страницу ЛЮБОГО пользователя как
 *  друга — без записи в friendships (не светимся в чужих списках друзей) и
 *  поверх тумблера sharesPrograms (владельцу сервиса нужен полный обзор,
 *  данные и так в его БД). */
export async function getFriendProfile(
  userId: string,
  otherId: string,
): Promise<FriendProfile | null> {
  const viewerIsAdmin = await isUserAdmin(userId);
  if (!viewerIsAdmin && !(await areFriends(userId, otherId))) return null;
  const [u] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      heightCm: schema.users.heightCm,
      sharesPrograms: schema.users.shareProgramsWithFriends,
    })
    .from(schema.users)
    .where(eq(schema.users.id, otherId))
    .limit(1);
  if (!u) return null;
  const latest = await getLatestMeasurement(otherId);
  return {
    ...u,
    // Админу открываем программы/оценки независимо от тумблера пользователя.
    sharesPrograms: u.sharesPrograms || viewerIsAdmin,
    weightKg: latest?.weightKg ?? null,
  };
}

/** Включён ли у юзера тумблер «делиться программами с друзьями» — для начального
 *  состояния переключателя на /friends. R-7: только своё значение. */
export async function getShareProgramsWithFriends(
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ value: schema.users.shareProgramsWithFriends })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.value ?? false;
}

/** Переключить «делиться программами с друзьями». R-7: правит только свою строку
 *  users. Тренировки друзей видны всегда; этот флаг открывает дополнительно
 *  шаблоны/программы + оценки ИИ-тренера на странице друга. */
export async function setShareProgramsWithFriends(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ shareProgramsWithFriends: enabled })
    .where(eq(schema.users.id, userId));
}

/** Дополнить строки дружбы карточкой «другого» пользователя одним запросом
 *  (inArray) вместо N+1. partnerIdOf указывает, какая сторона — партнёр. */
async function attachPartner(
  rows: schema.Friendship[],
  partnerIdOf: (r: schema.Friendship) => string,
): Promise<FriendshipWithUser[]> {
  if (rows.length === 0) return [];
  const partnerIds = Array.from(new Set(rows.map(partnerIdOf)));
  const partners = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, partnerIds));
  const byId = new Map(partners.map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const user = byId.get(partnerIdOf(r));
    if (!user) return []; // партнёр исчез (гонка с удалением) — пропускаем
    return [{ friendshipId: r.id, createdAt: r.createdAt, user }];
  });
}

/** Друзья с карточкой партнёра: партнёр — та сторона, что НЕ userId. R-7. */
export async function listFriendsDetailed(
  userId: string,
): Promise<FriendshipWithUser[]> {
  const rows = await listFriends(userId);
  return attachPartner(rows, (r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId,
  );
}

/** Друг + его последнее завершённое событие любого формата (H3.2). */
export type FriendActivity = {
  user: FriendUser;
  lastEvent: HistoryItem | null;
};

/** Лента активности друзей: для каждого принятого друга — последнее событие
 *  среди всех трёх форматов (силовая+круговая+кардио). R-7: данные тянем ТОЛЬКО
 *  для подтверждённых друзей (listFriendsDetailed уже отфильтровал accepted —
 *  тот же гейт, что прямое чтение тренировок друга по friendId). Порядок —
 *  лента (новые сверху, без событий в конец) через чистую sortFriendsByRecency.
 *  Без realtime/websocket (YAGNI). */
export async function listFriendsActivity(
  userId: string,
): Promise<FriendActivity[]> {
  const friends = await listFriendsDetailed(userId);
  if (friends.length === 0) return [];

  const activity = await Promise.all(
    friends.map(async (f): Promise<FriendActivity> => {
      // Небольшой лимит на формат: последнее завершённое событие всегда среди
      // самых свежих строк (active/cancelled отсеивает buildHistory внутри).
      const [strength, circuits, cardio] = await Promise.all([
        listRecentWorkouts(f.user.id, 8),
        listCircuits(f.user.id, 8),
        listRecentCardio(f.user.id, 8),
      ]);
      return {
        user: f.user,
        lastEvent: selectLastEvent(strength, circuits, cardio),
      };
    }),
  );

  return sortFriendsByRecency(activity);
}

/** Входящие заявки с карточкой отправителя (requester). R-7. */
export async function listIncomingRequestsDetailed(
  userId: string,
): Promise<FriendshipWithUser[]> {
  const rows = await listIncomingRequests(userId);
  return attachPartner(rows, (r) => r.requesterId);
}

/** Исходящие заявки с карточкой адресата (addressee). R-7. */
export async function listOutgoingRequestsDetailed(
  userId: string,
): Promise<FriendshipWithUser[]> {
  const rows = await listOutgoingRequests(userId);
  return attachPartner(rows, (r) => r.addresseeId);
}
