import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { pushKind } from "./enums";

/** Web Push подписка устройства. Один юзер может иметь несколько (телефон,
 *  десктоп). Endpoint уникален и идентифицирует подписку у push-сервиса
 *  (FCM, Mozilla autopush, Apple). disabledAt выставляется при 410 Gone
 *  от push-сервиса — больше не пытаемся слать. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { mode: "date", withTimezone: true }),
    disabledAt: timestamp("disabled_at", { mode: "date", withTimezone: true }),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** Лог отправленных уведомлений. Используется для дедупликации (не слать
 *  одно и то же напоминание дважды за день) и аналитики (доставлено/нет). */
export const notificationsLog = pgTable(
  "notifications_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: pushKind("kind").notNull(),
    payload: jsonb("payload"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Кол-во endpoint'ов, на которые ушло уведомление. */
    deliveredCount: integer("delivered_count").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("notifications_log_user_kind_idx").on(t.userId, t.kind, t.sentAt)],
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const notificationsLogRelations = relations(
  notificationsLog,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationsLog.userId],
      references: [users.id],
    }),
  }),
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationLog = typeof notificationsLog.$inferSelect;
