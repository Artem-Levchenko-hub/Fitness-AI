import { relations } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/** Запись о сне на конкретную дату (дата пробуждения). Одна на пользователя
 *  на дату. quality — субъективная оценка 1..5 (опционально, юзер может её
 *  пропустить и указать только часы). AI-тренер видит средние за 7 дней и
 *  замечает дефицит/нестабильность для оценки восстановления. */
export const sleepLogs = pgTable(
  "sleep_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Дата пробуждения. */
    date: date("date").notNull(),
    /** Часы сна (0..24, можно дробное — 7.5). */
    hours: doublePrecision("hours").notNull(),
    /** Качество сна 1..5 (опционально). */
    quality: integer("quality"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("sleep_logs_user_date_uniq").on(t.userId, t.date),
    index("sleep_logs_date_idx").on(t.date),
  ],
);

export const sleepLogsRelations = relations(sleepLogs, ({ one }) => ({
  user: one(users, { fields: [sleepLogs.userId], references: [users.id] }),
}));

export type SleepLog = typeof sleepLogs.$inferSelect;
export type NewSleepLog = typeof sleepLogs.$inferInsert;
