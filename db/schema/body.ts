import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/** Замер тела на дату. Все поля кроме id+userId+measuredAt — опциональные:
 *  юзер может писать только вес, или вес+BF%, или полный набор обхватов.
 *  Хранение в SI (kg, cm) — отображение конвертирует в lb/inches при
 *  необходимости. AI-коуч читает 3 последних замера для контекста
 *  тренда веса/композиции. */
export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    weightKg: doublePrecision("weight_kg"),
    bodyFatPct: doublePrecision("body_fat_pct"),

    waistCm: doublePrecision("waist_cm"),
    neckCm: doublePrecision("neck_cm"),
    chestCm: doublePrecision("chest_cm"),
    hipCm: doublePrecision("hip_cm"),
    armCm: doublePrecision("arm_cm"),
    thighCm: doublePrecision("thigh_cm"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("body_measurements_user_idx").on(t.userId, t.measuredAt)],
);

export const bodyMeasurementsRelations = relations(
  bodyMeasurements,
  ({ one }) => ({
    user: one(users, {
      fields: [bodyMeasurements.userId],
      references: [users.id],
    }),
  }),
);

export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
