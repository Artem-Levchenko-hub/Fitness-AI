import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { friendshipStatus } from "./enums";

/** Дружба между атлетами — направленная заявка requester → addressee.
 *  Одна строка на пару (не симметрично дублируем): кто отправил заявку
 *  (requester) и кому (addressee). После accept оба считаются друзьями —
 *  запросы «друзья юзера X» проверяют обе стороны (requester OR addressee).
 *
 *  - status = pending (заявка ждёт ответа) | accepted (друзья). Отклонение и
 *    разрыв дружбы = удаление строки (YAGNI до явного запроса; блок отдельно).
 *  - UNIQUE(requester, addressee) — нельзя дважды отправить одну и ту же
 *    заявку. Обратную (addressee→requester) БД не блокирует — логика в repo
 *    (проверяем существующую дружбу до создания встречной).
 *  - Индексы по обеим сторонам: список друзей и входящих заявок частые. */
export const friendships = pgTable(
  "friendships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("friendships_requester_addressee_unq").on(
      t.requesterId,
      t.addresseeId,
    ),
    index("friendships_requester_idx").on(t.requesterId),
    index("friendships_addressee_idx").on(t.addresseeId),
  ],
);

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.id],
    relationName: "friendship_requester",
  }),
  addressee: one(users, {
    fields: [friendships.addresseeId],
    references: [users.id],
    relationName: "friendship_addressee",
  }),
}));

export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;
