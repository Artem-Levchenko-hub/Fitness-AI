import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { templateSource } from "./enums";
import { exercises } from "./exercises";
import { trainingPrograms } from "./training-programs";

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
  notes: string | null;
  /** Миорепс-протокол. Опциональны: старые снимки (до 0029) их не содержат —
   *  восстановление подставляет дефолты (выкл). */
  myoReps?: boolean;
  myoMiniSets?: number;
  myoMiniReps?: number;
  myoMiniRestSeconds?: number;
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
    /** Миорепсы: targetSets игнорируется как счётчик — план = 1 активационный
     *  подход (targetRepsMin–Max почти до отказа) + myoMiniSets мини-сетов по
     *  myoMiniReps повторов с отдыхом myoMiniRestSeconds (10–20 с). Подходы
     *  пишутся обычными working-строками (объём/PR/статистика работают без
     *  спец-логики; мини никогда не перебьёт активационный по weight×reps). */
    myoReps: boolean("myo_reps").notNull().default(false),
    myoMiniSets: integer("myo_mini_sets").notNull().default(4),
    myoMiniReps: integer("myo_mini_reps").notNull().default(4),
    myoMiniRestSeconds: integer("myo_mini_rest_seconds").notNull().default(15),
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

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;
export type TemplateExercise = typeof templateExercises.$inferSelect;
