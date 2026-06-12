import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { cardioPreset } from "./enums";

/** Шаблон кардио-тренировки (H14.3). Принадлежит пользователю — именованный
 *  переиспользуемый пресет кардио. В отличие от circuit_templates у кардио НЕТ
 *  упражнений-детей: блоки выводятся детерминированно из preset+params через
 *  presetToBlocks (lib/domain/cardio/presets.ts) → одна таблица, без child-строк.
 *  planJson = снимок параметров (rounds/workSec/restSec для custom, emomRounds
 *  для emom; пусто для tabata/norwegian_4x4). Старт из шаблона переиспользует
 *  startCardioFromPreset (H14.4). Зеркалит cardio_workouts, но без runtime-полей
 *  (status/startedAt/finishedAt/блоки) и с template-таймстампами. */
export const cardioTemplates = pgTable(
  "cardio_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    preset: cardioPreset("preset").notNull().default("custom"),
    planJson: jsonb("plan_json"),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("cardio_templates_user_idx").on(t.userId)],
);

export const cardioTemplatesRelations = relations(
  cardioTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [cardioTemplates.userId],
      references: [users.id],
    }),
  }),
);

export type CardioTemplate = typeof cardioTemplates.$inferSelect;
export type NewCardioTemplate = typeof cardioTemplates.$inferInsert;
