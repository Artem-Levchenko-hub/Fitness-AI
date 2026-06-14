import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { workoutTemplates } from "./templates";

/** Тренировочная система (программа) — именованная связка шаблонов-дней.
 *  Всегда принадлежит пользователю. Готовая библиотека программ живёт
 *  TS-каталогом (lib/domain/programs/library.ts), а не строками БД: «Использовать»
 *  глубоко копирует пресет в строки юзера, сама библиотека остаётся неизменной.
 *  Так R-7 цел (нет nullable userId) и у каждого свой прогресс на своей копии. */
export const trainingPrograms = pgTable(
  "training_programs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** slug пресета из библиотеки, если программа скопирована оттуда; null —
     *  собрана вручную из своих шаблонов. Для бейджа «из библиотеки». */
    librarySlug: text("library_slug"),
    /** Активна ли система: её дни-шаблоны показываются в общем списке «Шаблоны»
     *  ТОЛЬКО когда активна. Библиотечная копия создаётся неактивной (на полке),
     *  «Начать тренироваться» активирует; обёртка своих шаблонов — сразу активна
     *  (они уже были в «Шаблонах»). null = на полке (только в Библиотеке). */
    activatedAt: timestamp("activated_at", { mode: "date", withTimezone: true }),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("training_programs_user_idx").on(t.userId)],
);

export const trainingProgramsRelations = relations(
  trainingPrograms,
  ({ one, many }) => ({
    user: one(users, {
      fields: [trainingPrograms.userId],
      references: [users.id],
    }),
    /** Дни программы — упорядоченные шаблоны (workout_templates.dayOrder). */
    days: many(workoutTemplates),
  }),
);

export type TrainingProgram = typeof trainingPrograms.$inferSelect;
export type NewTrainingProgram = typeof trainingPrograms.$inferInsert;
