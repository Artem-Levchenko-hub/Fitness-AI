import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { setScheme, templateSource } from "./enums";
import { exercises } from "./exercises";
import { trainingPrograms } from "./training-programs";
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
  type SetScheme,
} from "../../lib/domain/workouts/myo-reps";

/** Один элемент снимка-оригинала шаблона (template_exercises минус identity-id):
 *  ровно то, что нужно восстановить при откате адаптации. Зеркалит вставку в
 *  template_exercises. */
export type PreAdaptSnapshotItem = {
  exerciseId: string;
  position: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg: number | null;
  targetRestSeconds: number;
  setScheme?: SetScheme;
  myoMiniSets?: number;
  myoRepsPercent?: number;
  myoRestSeconds?: number;
  myoFirstRestSeconds?: number;
  notes: string | null;
};

/** Шаблон тренировки. Принадлежит пользователю — стабильный набор
 *  упражнений с целевыми параметрами. */
export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Авторство: manual (атлет) или trainer (авто-«следующая тренировка»). */
    source: templateSource("source").notNull().default("manual"),
    /** Силовая, по которой тренер составил прогрессию — ключ идемпотентности
     *  (одна trainer-шаблон-«следующая» на завершённую тренировку). Nullable:
     *  у ручных шаблонов источника нет. */
    sourceWorkoutId: text("source_workout_id"),
    /** Программа (тренировочная система), днём которой является этот шаблон.
     *  null — одиночный шаблон. SET NULL при удалении программы — день
     *  отвязывается в standalone, данные не теряются. */
    programId: text("program_id").references(() => trainingPrograms.id, {
      onDelete: "set null",
    }),
    /** Порядок дня внутри программы (0-индекс). null у одиночных шаблонов. */
    dayOrder: integer("day_order"),
    /** Последняя тренировка, по которой шаблон адаптирован на месте
     *  (тренер правил вес/повторы прямо здесь) — ключ идемпотентности:
     *  повторный finish / офлайн-реплей с тем же workoutId = no-op. Маркер
     *  «Улучшено тренером» (non-null = адаптирован). Силовой, как программный
     *  день, так и одиночный шаблон. */
    lastAdaptedWorkoutId: text("last_adapted_workout_id"),
    /** Снимок ОРИГИНАЛЬНЫХ template_exercises, снятый ОДИН раз — перед ПЕРВОЙ
     *  адаптацией тренером. Нужен для отката («Отменить корректировку ИИ
     *  тренера»). null — шаблон ещё ни разу не адаптирован (или уже откатан).
     *  Один снимок-до-оригинала (YAGNI, R-05): история ревизий не нужна. */
    preAdaptSnapshot: jsonb("pre_adapt_snapshot").$type<PreAdaptSnapshotItem[]>(),
    /** Когда тренер в последний раз адаптировал шаблон — для подписи
     *  «Улучшено тренером · <дата>». null — не адаптирован. */
    adaptedAt: timestamp("adapted_at", { mode: "date", withTimezone: true }),
    /** Липкий отказ от авто-адаптации: после отката тренер БОЛЬШЕ не переписывает
     *  этот шаблон сам (атлет вернул свой вариант и не хочет правок), пока заново
     *  не включит. true → finish пропускает адаптацию этого шаблона. */
    adaptOptOut: boolean("adapt_opt_out").notNull().default(false),
    /** Позиция в основном потоке «Твои тренировки». null = не закреплён. */
    pinnedPosition: integer("pinned_position"),
    /** Номер активного неизменяемого снимка в template_versions. */
    currentVersion: integer("current_version").notNull().default(1),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("workout_templates_user_idx").on(t.userId),
    index("workout_templates_program_idx").on(t.programId, t.dayOrder),
    uniqueIndex("workout_templates_user_pinned_position_uk")
      .on(t.userId, t.pinnedPosition)
      .where(sql`${t.pinnedPosition} is not null`),
  ],
);

export type TemplateVersionSource = "manual" | "trainer" | "rollback";

/** Неизменяемый снимок рабочего шаблона. Текущие template_exercises остаются
 *  быстрым read-model для старта тренировки, а эта таблица даёт сравнение,
 *  подтверждение и безопасный откат без потери предыдущих вариантов. */
export const templateVersions = pgTable(
  "template_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    source: text("source").$type<TemplateVersionSource>().notNull(),
    sourceWorkoutId: text("source_workout_id"),
    snapshot: jsonb("snapshot").$type<PreAdaptSnapshotItem[]>().notNull(),
    summary: text("summary").notNull(),
    rationale: text("rationale"),
    confidence: doublePrecision("confidence"),
    requiresConfirmation: boolean("requires_confirmation")
      .notNull()
      .default(false),
    confirmedAt: timestamp("confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("template_versions_template_number_uk").on(
      t.templateId,
      t.versionNumber,
    ),
    uniqueIndex("template_versions_template_source_workout_uk")
      .on(t.templateId, t.sourceWorkoutId)
      .where(sql`${t.sourceWorkoutId} is not null`),
    index("template_versions_template_created_idx").on(
      t.templateId,
      t.createdAt,
    ),
  ],
);

/** Упражнение в шаблоне с порядком и целевыми параметрами.
 *  targetWeight/Reps/Rest — рекомендация, фактические значения
 *  пишутся в workout_sets при выполнении. */
export const templateExercises = pgTable(
  "template_exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    targetRepsMin: integer("target_reps_min").notNull().default(8),
    targetRepsMax: integer("target_reps_max").notNull().default(12),
    targetWeightKg: doublePrecision("target_weight_kg"),
    targetRestSeconds: integer("target_rest_seconds").notNull().default(120),
    setScheme: setScheme("set_scheme").notNull().default("straight"),
    myoMiniSets: integer("myo_mini_sets")
      .notNull()
      .default(DEFAULT_MYO_MINI_SETS),
    myoRepsPercent: integer("myo_reps_percent")
      .notNull()
      .default(DEFAULT_MYO_REPS_PERCENT),
    myoRestSeconds: integer("myo_rest_seconds")
      .notNull()
      .default(DEFAULT_MYO_REST_SECONDS),
    myoFirstRestSeconds: integer("myo_first_rest_seconds")
      .notNull()
      .default(DEFAULT_MYO_FIRST_REST_SECONDS),
    notes: text("notes"),
  },
  (t) => [
    index("template_exercises_template_idx").on(t.templateId, t.position),
  ],
);

export const workoutTemplatesRelations = relations(
  workoutTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutTemplates.userId],
      references: [users.id],
    }),
    /** Программа-владелец, если шаблон — день тренировочной системы. */
    program: one(trainingPrograms, {
      fields: [workoutTemplates.programId],
      references: [trainingPrograms.id],
    }),
    items: many(templateExercises),
  }),
);

export const templateExercisesRelations = relations(
  templateExercises,
  ({ one }) => ({
    template: one(workoutTemplates, {
      fields: [templateExercises.templateId],
      references: [workoutTemplates.id],
    }),
    exercise: one(exercises, {
      fields: [templateExercises.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export const templateVersionsRelations = relations(
  templateVersions,
  ({ one }) => ({
    template: one(workoutTemplates, {
      fields: [templateVersions.templateId],
      references: [workoutTemplates.id],
    }),
  }),
);

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type TemplateExercise = typeof templateExercises.$inferSelect;
export type TemplateVersion = typeof templateVersions.$inferSelect;
