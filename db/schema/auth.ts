import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { experienceLevel, localeEnum, weightUnit } from "./enums";

/** Auth.js users table extended with project-specific profile fields. */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),

  weightUnitPref: weightUnit("weight_unit_pref").notNull().default("kg"),
  timezone: text("timezone").notNull().default("Europe/Moscow"),
  experience: experienceLevel("experience").notNull().default("intermediate"),
  locale: localeEnum("locale").notNull().default("ru"),

  /** Опционально — для расчёта возраста и более точных рекомендаций AI. */
  birthDate: date("birth_date"),
  /** Рост в см, опционально. */
  heightCm: integer("height_cm"),
  /** Пол в свободной форме (male/female/other) — опционально, AI может
   *  адаптировать рекомендации (например, женские ProT нормы отличаются). */
  sex: text("sex"),

  /** Делиться с друзьями своими шаблонами/программами + оценками ИИ-тренера
   *  (overallScore). Тренировки друзей видны всегда; этот тумблер дополнительно
   *  открывает программы и оценки на странице друга. По умолчанию выкл —
   *  приватность не падает без явного согласия. */
  shareProgramsWithFriends: boolean("share_programs_with_friends")
    .notNull()
    .default(false),

  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
