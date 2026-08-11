import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { myoMiniRepsFromActivation } from "@/lib/domain/workouts/myo";
import { mergeCoachTemplateItems } from "@/lib/domain/templates/coach-template-update";
import { getActiveWorkoutForUser, recordSet, saveWorkoutNote } from "@/lib/repos/workouts.repo";
import { listExercises } from "@/lib/repos/exercises.repo";
import { logQuickActivity } from "@/lib/repos/quick-activity.repo";
import {
  getTemplateWithItems,
  listTemplates,
  updateTemplate,
} from "@/lib/repos/templates.repo";

const templateItemSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().min(1).max(20),
  targetRepsMin: z.number().int().min(1).max(100),
  targetRepsMax: z.number().int().min(1).max(100),
  targetWeightKg: z.number().min(0).max(1000).nullable().optional(),
  targetRestSeconds: z.number().int().min(15).max(900),
  myoReps: z.boolean().optional(),
  myoMiniSets: z.number().int().min(1).max(10).optional(),
  myoMiniReps: z.number().int().min(1).max(30).optional(),
  myoMiniRestSeconds: z.number().int().min(5).max(30).optional(),
  notes: z.string().max(500).nullable().optional(),
});

const templateUpdateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  /** Полный новый список нужен, когда AI меняет состав или назначения. */
  items: z.array(templateItemSchema).min(1).max(30).optional(),
});

const quickActivitySchema = z.object({
  exerciseId: z.string().uuid(),
  mode: z.enum(["sets", "myo_reps", "total"]),
  reps: z.number().int().min(1).max(10_000),
  myoMiniSets: z.number().int().min(1).max(10).optional(),
  myoMiniReps: z.number().int().min(1).max(30).optional(),
  weightKg: z.number().min(0).max(500).nullable().optional(),
});

const noteSchema = z.object({
  content: z.string().trim().min(3).max(2_000),
  kind: z.enum(["observation", "plan", "recovery", "pain", "preference"]),
  workoutId: z.string().uuid().optional(),
});

const recordSetSchema = z.object({
  workoutId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
  setIndex: z.number().int().min(0).max(50).optional(),
  weightKg: z.number().min(0).max(1_000),
  reps: z.number().int().min(1).max(100),
  rpe: z.number().min(1).max(10).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3_600).nullable().optional(),
});

function formatTemplateItem(item: Awaited<ReturnType<typeof getTemplateWithItems>> extends infer T
  ? T extends { items: infer I }
    ? I extends Array<infer E>
      ? E
      : never
    : never
  : never) {
  return {
    exerciseId: item.exerciseId,
    name: item.exerciseNameRu,
    sets: item.targetSets,
    reps: `${item.targetRepsMin}-${item.targetRepsMax}`,
    weightKg: item.targetWeightKg,
    restSeconds: item.targetRestSeconds,
    myoReps: item.myoReps,
    myoMiniSets: item.myoMiniSets,
    myoMiniReps: item.myoMiniReps,
    myoMiniRestSeconds: item.myoMiniRestSeconds,
    notes: item.notes,
  };
}

export function createCoachTools(userId: string, currentWorkoutId: string) {
  return {
    list_workout_templates: tool({
      description:
        "Прочитать шаблоны атлета и их реальные упражнения перед любым изменением. Используй, когда пользователь спрашивает о шаблоне или просит его настроить.",
      inputSchema: z.object({
        templateId: z.string().uuid().optional(),
      }),
      execute: async ({ templateId }) => {
        if (templateId) {
          const template = await getTemplateWithItems(userId, templateId);
          if (!template) return { ok: false, error: "Шаблон не найден" };
          return {
            ok: true,
            templates: [
              {
                id: template.id,
                name: template.name,
                description: template.description,
                items: template.items.map(formatTemplateItem),
              },
            ],
          };
        }

        const templates = await listTemplates(userId);
        const detailed = await Promise.all(
          templates.slice(0, 20).map(async (summary) => {
            const template = await getTemplateWithItems(userId, summary.id);
            return template
              ? {
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  source: summary.source,
                  adapted: summary.adapted,
                  items: template.items.map(formatTemplateItem),
                }
              : null;
          }),
        );
        return { ok: true, templates: detailed.filter(Boolean) };
      },
    }),

    search_exercises: tool({
      description:
        "Найти доступные системные или пользовательские упражнения и получить их настоящие ID. Никогда не придумывай exerciseId.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(80),
      }),
      execute: async ({ query }) => {
        const exercises = await listExercises(userId, { search: query });
        return {
          ok: true,
          exercises: exercises.slice(0, 30).map((exercise) => ({
            id: exercise.id,
            name: exercise.nameRu,
            nameEn: exercise.nameEn,
            slug: exercise.slug,
            primaryMuscles: exercise.primaryMuscles,
            secondaryMuscles: exercise.secondaryMuscles,
          })),
        };
      },
    }),

    get_active_workout: tool({
      description:
        "Показать текущую тренировку и уже записанные подходы. Используй перед записью подхода, чтобы взять настоящий workoutExerciseId и следующий индекс.",
      inputSchema: z.object({
        workoutId: z.string().uuid().optional(),
      }),
      execute: async ({ workoutId }) => {
        const id = workoutId ?? currentWorkoutId;
        const workout = await getActiveWorkoutForUser(userId, id);
        if (!workout) return { ok: false, error: "Тренировка не найдена" };
        return {
          ok: true,
          workout: {
            id: workout.id,
            name: workout.name,
            status: workout.status,
            exercises: workout.exercises.map((exercise) => ({
              workoutExerciseId: exercise.id,
              exerciseId: exercise.exerciseId,
              name: exercise.exerciseNameRu,
              target: {
                sets: exercise.targetSets,
                reps: `${exercise.targetRepsMin}-${exercise.targetRepsMax}`,
                weightKg: exercise.targetWeightKg,
                myoReps: exercise.myoReps,
                myoMiniSets: exercise.myoMiniSets,
                myoMiniReps: exercise.myoMiniReps,
              },
              completedSets: exercise.sets.map((set) => ({
                setIndex: set.setIndex,
                weightKg: set.weightKg,
                reps: set.reps,
                rpe: set.rpe,
                restSeconds: set.restSeconds,
                setType: set.setType,
              })),
            })),
          },
        };
      },
    }),

    update_workout_template: tool({
      description:
        "Изменить шаблон только после явной просьбы пользователя: добавить/убрать упражнение, изменить вес, подходы, повторы или Myo-протокол. Перед вызовом сначала прочитай шаблон; передавай полный новый список items. Не меняй шаблон, если пользователь только просит совет. Если упражнение уже использует Myo-reps, не отключай этот режим без прямой просьбы: после активационного подхода мини-сеты равны примерно 30% его фактических повторов, отдых между ними не больше 30 секунд.",
      inputSchema: templateUpdateSchema,
      execute: async (input) => {
        const parsed = templateUpdateSchema.parse(input);
        const current = await getTemplateWithItems(userId, parsed.templateId);
        if (!current) return { ok: false, error: "Шаблон не найден" };

        const visibleExercises = await listExercises(userId);
        const visibleIds = new Set(visibleExercises.map((exercise) => exercise.id));
        const items = parsed.items
          ? mergeCoachTemplateItems(parsed.items, current.items)
          : current.items.map((item) => ({
              exerciseId: item.exerciseId,
              targetSets: item.targetSets,
              targetRepsMin: item.targetRepsMin,
              targetRepsMax: item.targetRepsMax,
              targetWeightKg: item.targetWeightKg,
              targetRestSeconds: item.targetRestSeconds,
              myoReps: item.myoReps,
              myoMiniSets: item.myoMiniSets,
              myoMiniReps: item.myoMiniReps,
              myoMiniRestSeconds: item.myoMiniRestSeconds,
              notes: item.notes,
            }));

        const missingExerciseIds = items
          .map((item) => item.exerciseId)
          .filter((id) => !visibleIds.has(id));
        if (missingExerciseIds.length > 0) {
          return {
            ok: false,
            error: "В шаблоне есть недоступные упражнения; сначала найди их через search_exercises.",
            exerciseIds: missingExerciseIds,
          };
        }
        if (items.some((item) => item.targetRepsMin > item.targetRepsMax)) {
          return { ok: false, error: "Минимум повторов не может быть больше максимума" };
        }

        await updateTemplate(userId, current.id, {
          name: parsed.name ?? current.name,
          description:
            parsed.description === undefined ? current.description : parsed.description,
          items,
        });
        revalidatePath("/templates");
        revalidatePath(`/templates/${current.id}`);
        revalidatePath("/create");
        return {
          ok: true,
          templateId: current.id,
          message: `Шаблон «${parsed.name ?? current.name}» обновлён.`,
          items: items.map((item) => ({
            exerciseId: item.exerciseId,
            sets: item.targetSets,
            reps: `${item.targetRepsMin}-${item.targetRepsMax}`,
            weightKg: item.targetWeightKg,
            myoReps: item.myoReps,
          })),
        };
      },
    }),

    record_workout_set: tool({
      description:
        "Записать фактически выполненный подход в открытую тренировку. Используй только если пользователь явно сказал записать/сохранить подход и назвал точные вес и повторы; не превращай рекомендацию в факт. Сначала вызови get_active_workout.",
      inputSchema: recordSetSchema,
      execute: async (input) => {
        const parsed = recordSetSchema.parse(input);
        const workout = await getActiveWorkoutForUser(userId, parsed.workoutId);
        if (!workout) return { ok: false, error: "Тренировка не найдена" };
        if (workout.status !== "active") {
          return { ok: false, error: "Тренировка уже завершена — новый подход не записан" };
        }
        const exercise = workout.exercises.find((item) => item.id === parsed.workoutExerciseId);
        if (!exercise) return { ok: false, error: "Упражнение не входит в эту тренировку" };
        const nextIndex =
          parsed.setIndex ??
          (exercise.sets.reduce((max, set) => Math.max(max, set.setIndex), -1) + 1);
        await recordSet(userId, parsed.workoutId, {
          workoutExerciseId: parsed.workoutExerciseId,
          setIndex: nextIndex,
          weightKg: parsed.weightKg,
          reps: parsed.reps,
          rpe: parsed.rpe ?? null,
          restSeconds: parsed.restSeconds ?? null,
        });
        revalidatePath(`/workouts/${parsed.workoutId}`);
        revalidatePath("/dashboard");
        return {
          ok: true,
          message: `${exercise.exerciseNameRu}: ${parsed.weightKg} кг × ${parsed.reps} записано как подход ${nextIndex + 1}.`,
          workoutId: parsed.workoutId,
          workoutExerciseId: parsed.workoutExerciseId,
          setIndex: nextIndex,
        };
      },
    }),

    log_quick_activity: tool({
      description:
        "Записать доп. активность вне тренировки. Используй только после явной просьбы «запиши/сохрани» с точными фактическими повторами и весом. Для Myo-reps передай активацию и число мини-сетов; сервер сам зафиксирует мини-повторы и это попадёт в общие подходы статистики.",
      inputSchema: quickActivitySchema,
      execute: async (input) => {
        const parsed = quickActivitySchema.parse(input);
        const exercise = (await listExercises(userId)).find((item) => item.id === parsed.exerciseId);
        if (!exercise) return { ok: false, error: "Упражнение не найдено или недоступно" };
        const myoMiniSets = parsed.myoMiniSets ?? 3;
        const myoMiniReps =
          parsed.mode === "myo_reps"
            ? myoMiniRepsFromActivation(parsed.reps)
            : parsed.myoMiniReps;
        const row = await logQuickActivity(userId, {
          exerciseId: parsed.exerciseId,
          mode: parsed.mode,
          reps: parsed.reps,
          myoMiniSets,
          myoMiniReps,
          weightKg: parsed.weightKg ?? null,
        });
        revalidatePath("/dashboard");
        revalidatePath("/stats");
        revalidatePath("/profile");
        return {
          ok: true,
          id: row.id,
          message:
            parsed.mode === "myo_reps"
              ? `${exercise.nameRu}: Myo-reps ${parsed.reps} + ${myoMiniSets} мини-сета записаны.`
              : `${exercise.nameRu}: ${parsed.reps} повторов записаны.`,
        };
      },
    }),

    save_training_note: tool({
      description:
        "Сохранить долговечную заметку в память тренера: боль, самочувствие, предпочтение, договорённость или план. Используй, когда пользователь явно просит запомнить или сообщает важный факт, который пригодится позже.",
      inputSchema: noteSchema,
      execute: async (input) => {
        const parsed = noteSchema.parse(input);
        const workoutId = parsed.workoutId ?? currentWorkoutId;
        const workout = await getActiveWorkoutForUser(userId, workoutId);
        if (!workout) return { ok: false, error: "Тренировка не найдена" };
        const labels = {
          observation: "Наблюдение",
          plan: "План",
          recovery: "Восстановление",
          pain: "Боль/ограничение",
          preference: "Предпочтение",
        } as const;
        await saveWorkoutNote(
          userId,
          workoutId,
          `## ${labels[parsed.kind]} · заметка из чата\n\n${parsed.content}`,
          "manual",
        );
        revalidatePath(`/workouts/${workoutId}`);
        revalidatePath("/dashboard");
        return { ok: true, message: "Сохранил это в память тренера." };
      },
    }),
  };
}
