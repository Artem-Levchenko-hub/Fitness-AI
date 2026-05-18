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

/** Дневная запись КБЖУ. Одна на дату на пользователя (uniq на user_id+date).
 *  Все макро-поля nullable — юзер может писать только калорийность, или
 *  не указывать ничего и просто отметиться («сегодня не считаю»).
 *  AI-тренер использует записи за последние 7 дней как контекст. */
export const nutritionEntries = pgTable(
  "nutrition_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Дата, к которой относится приём пищи (local-day юзера). */
    date: date("date").notNull(),

    kcal: integer("kcal"),
    proteinG: doublePrecision("protein_g"),
    fatG: doublePrecision("fat_g"),
    carbsG: doublePrecision("carbs_g"),

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
    uniqueIndex("nutrition_entries_user_date_uniq").on(t.userId, t.date),
    index("nutrition_entries_date_idx").on(t.date),
  ],
);

export const nutritionEntriesRelations = relations(
  nutritionEntries,
  ({ one }) => ({
    user: one(users, {
      fields: [nutritionEntries.userId],
      references: [users.id],
    }),
  }),
);

export type NutritionEntry = typeof nutritionEntries.$inferSelect;
export type NewNutritionEntry = typeof nutritionEntries.$inferInsert;
