import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

/** Админ-доступ (владелец сервиса). Гейт двойной: страницы зовут requireAdmin
 *  (lib/auth/require-admin), а listUsersOverview дополнительно сам проверяет
 *  права вызывающего — обзор всех пользователей не должен утечь через забытый
 *  гейт. R-7 удерживаем: каждая функция принимает userId действующего
 *  пользователя и решает по нему. */

export async function isUserAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isAdmin: schema.users.isAdmin })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.isAdmin ?? false;
}

/** Строка обзора пользователя: профиль + активность по трём форматам
 *  (только completed) + деньги (кредиты в копейках, тариф подписки). */
export type AdminUserOverview = {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  /** Последняя завершённая тренировка любого формата; null — ещё не тренировался. */
  lastActivityAt: Date | null;
  strengthCount: number;
  circuitCount: number;
  cardioCount: number;
  balanceKopecks: number;
  totalPurchasedKopecks: number;
  totalSpentKopecks: number;
  tier: string | null;
};

/** timestamptz из raw-sql (greatest/max) может прийти строкой — нормализуем. */
function toDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Обзор ВСЕХ пользователей для /admin: кто когда зарегистрировался, когда и
 *  сколько тренировался, сколько купил/потратил кредитов. Сортировка — лента
 *  (последняя активность сверху, «спящие» в конец по дате регистрации).
 *  Только для админа: не-админу бросаем, а не возвращаем пусто, чтобы забытый
 *  гейт на странице упал громко, а не тихо показал пустой список. */
export async function listUsersOverview(
  adminUserId: string,
): Promise<AdminUserOverview[]> {
  if (!(await isUserAdmin(adminUserId))) {
    throw new Error("Обзор пользователей доступен только админу");
  }

  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      createdAt: schema.users.createdAt,
      balanceKopecks: sql<number>`coalesce(${schema.userCredits.balanceKopecks}, 0)`,
      totalPurchasedKopecks: sql<number>`coalesce(${schema.userCredits.totalPurchasedKopecks}, 0)`,
      totalSpentKopecks: sql<number>`coalesce(${schema.userCredits.totalSpentKopecks}, 0)`,
      tier: schema.subscriptions.tier,
      strengthCount: sql<number>`(select count(*)::int from workouts w where w.user_id = ${schema.users.id} and w.status = 'completed')`,
      circuitCount: sql<number>`(select count(*)::int from circuit_workouts c where c.user_id = ${schema.users.id} and c.status = 'completed')`,
      cardioCount: sql<number>`(select count(*)::int from cardio_workouts cw where cw.user_id = ${schema.users.id} and cw.status = 'completed')`,
      lastActivityAt: sql<string | null>`greatest(
        (select max(w.started_at) from workouts w where w.user_id = ${schema.users.id} and w.status = 'completed'),
        (select max(c.started_at) from circuit_workouts c where c.user_id = ${schema.users.id} and c.status = 'completed'),
        (select max(cw.started_at) from cardio_workouts cw where cw.user_id = ${schema.users.id} and cw.status = 'completed')
      )`,
    })
    .from(schema.users)
    .leftJoin(
      schema.userCredits,
      eq(schema.userCredits.userId, schema.users.id),
    )
    .leftJoin(
      schema.subscriptions,
      eq(schema.subscriptions.userId, schema.users.id),
    );

  return rows
    .map((r) => ({ ...r, lastActivityAt: toDate(r.lastActivityAt) }))
    .sort((a, b) => {
      const at = a.lastActivityAt?.getTime() ?? Number.NEGATIVE_INFINITY;
      const bt = b.lastActivityAt?.getTime() ?? Number.NEGATIVE_INFINITY;
      if (bt !== at) return bt - at;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
}
