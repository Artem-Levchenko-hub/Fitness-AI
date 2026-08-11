import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const STRENGTH_MOVEMENTS = [
  "pull_up",
  "back_squat",
  "bench_press",
] as const;

export type StrengthMovement = (typeof STRENGTH_MOVEMENTS)[number];

/** Результаты трёх одинаково трактуемых контрольных тестов:
 *  строгие подтягивания — максимум повторений за один подход;
 *  присед и жим лёжа — лучший одиночный вес в килограммах. */
export const strengthRecords = pgTable(
  "strength_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movement: text("movement").$type<StrengthMovement>().notNull(),
    value: doublePrecision("value").notNull(),
    performedAt: date("performed_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("strength_records_user_movement_date_idx").on(
      t.userId,
      t.movement,
      t.performedAt,
    ),
    check(
      "strength_records_movement_check",
      sql`${t.movement} in ('pull_up', 'back_squat', 'bench_press')`,
    ),
    check("strength_records_value_check", sql`${t.value} >= 1`),
    check(
      "strength_records_value_format_check",
      sql`(${t.movement} = 'pull_up' and ${t.value} <= 200 and ${t.value} = trunc(${t.value})) or (${t.movement} <> 'pull_up' and ${t.value} <= 1000 and ${t.value} * 2 = trunc(${t.value} * 2))`,
    ),
  ],
);

export const strengthRecordsRelations = relations(
  strengthRecords,
  ({ one }) => ({
    user: one(users, {
      fields: [strengthRecords.userId],
      references: [users.id],
    }),
  }),
);

export type StrengthRecord = typeof strengthRecords.$inferSelect;
export type NewStrengthRecord = typeof strengthRecords.$inferInsert;
