"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { env } from "@/lib/env";
import {
  cancelWorkout,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  recordSet,
  saveWorkoutNote,
  startWorkoutFromTemplate,
} from "@/lib/repos/workouts.repo";
import { feelingNoteLine } from "@/lib/domain/workouts/feeling";
import { parseClientSetId } from "@/lib/domain/workouts/client-set-id";

const startSchema = z.object({
  templateId: z.string().uuid(),
});

export async function startWorkoutFromTemplateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) throw new Error("Invalid templateId");

  const { id } = await startWorkoutFromTemplate(user.id, parsed.data.templateId);
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  redirect(`/workouts/${id}`);
}

const recordSetSchema = z.object({
  workoutId: z.string().uuid(),
  workoutExerciseId: z.string().uuid(),
  setIndex: z.coerce.number().int().min(0).max(50),
  weightKg: z.coerce.number().min(0).max(1000),
  reps: z.coerce.number().int().min(1).max(100),
  rpe: z
    .union([z.coerce.number().min(1).max(10), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
  restSeconds: z
    .union([z.coerce.number().int().min(0).max(3600), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v))),
});

export type RecordSetState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function recordSetAction(
  _prev: RecordSetState,
  formData: FormData,
): Promise<RecordSetState> {
  const user = await requireUser();
  const parsed = recordSetSchema.safeParse({
    workoutId: formData.get("workoutId"),
    workoutExerciseId: formData.get("workoutExerciseId"),
    setIndex: formData.get("setIndex"),
    weightKg: formData.get("weightKg"),
    reps: formData.get("reps"),
    rpe: formData.get("rpe") ?? undefined,
    restSeconds: formData.get("restSeconds") ?? undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      status: "error",
      message: first?.message ?? "Проверьте поля подхода",
    };
  }

  // H15.3b — канонический ключ идемпотентности подхода. Онлайн-сабмит шлёт
  // свежий UUID; офлайн-реплей (H15.4) повторит ТОТ ЖЕ ключ → onConflictDoNothing
  // в recordSet делает дубль no-op. Мусор/отсутствие → null (legacy-вставка,
  // fail-soft R-10) — запись не падает из-за битого ключа.
  const clientSetId = parseClientSetId(formData.get("clientSetId"));

  await recordSet(user.id, parsed.data.workoutId, {
    workoutExerciseId: parsed.data.workoutExerciseId,
    setIndex: parsed.data.setIndex,
    weightKg: parsed.data.weightKg,
    reps: parsed.data.reps,
    rpe: parsed.data.rpe,
    restSeconds: parsed.data.restSeconds,
    clientSetId,
  });
  revalidatePath(`/workouts/${parsed.data.workoutId}`);
  return { status: "idle" };
}

const deleteSetSchema = z.object({
  workoutId: z.string().uuid(),
  setId: z.string().uuid(),
});

export async function deleteSetAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteSetSchema.safeParse({
    workoutId: formData.get("workoutId"),
    setId: formData.get("setId"),
  });
  if (!parsed.success) throw new Error("Invalid set/workout id");
  await deleteSet(user.id, parsed.data.workoutId, parsed.data.setId);
  revalidatePath(`/workouts/${parsed.data.workoutId}`);
}

export async function finishWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));
  if (!workoutId) throw new Error("Missing workoutId");

  const feeling = String(formData.get("feeling") ?? "").trim();
  // Pliability-тап «легко/норм/тяжело» (H11.3) — одно касание вместо набора.
  const feelingLine = feelingNoteLine(String(formData.get("feelingTag") ?? ""));

  await finishWorkout(user.id, workoutId);

  // Самочувствие атлета → одна workout_note. Тап и/или свободный текст
  // объединяются в одну заметку (не плодим строки — context-builder берёт лишь
  // 4 свежих). source=auto_generated, если был только тап; manual, если атлет
  // что-то напечатал. AI-тренер читает заметки целиком при разборе.
  const noteParts = [feelingLine, feeling].filter(Boolean) as string[];
  if (noteParts.length > 0) {
    await saveWorkoutNote(
      user.id,
      workoutId,
      noteParts.join("\n").slice(0, 1000),
      feeling ? "manual" : "auto_generated",
    );
  }

  // Ставим post_workout аналитический job. Если уже стоит (на случай
  // двойного finish — пользователь дважды тапнул) — не дублируем.
  const [existing] = await db
    .select({ id: schema.aiJobs.id })
    .from(schema.aiJobs)
    .where(
      and(
        eq(schema.aiJobs.workoutId, workoutId),
        eq(schema.aiJobs.kind, "post_workout"),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(schema.aiJobs).values({
      userId: user.id,
      workoutId,
      kind: "post_workout",
      status: "pending",
    });

    // Триггерим воркер сразу. Если упало — cron-runner подхватит в течение минуты.
    if (env.CRON_SECRET) {
      try {
        void fetch(`${env.NEXT_PUBLIC_APP_URL}/api/cron/process-ai-jobs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
        });
      } catch {
        /* пусто */
      }
    }
  }

  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");

  // Trainer (structured JSON оценка) — основной flow. Coach (диалог) теперь
  // вторичен, доступен через кнопку на trainer/completed-view.
  redirect(`/workouts/${workoutId}/trainer`);
}

const cancelSchema = z.object({ workoutId: z.string().uuid() });

/** H2: «Убрать» зависшую активную силовую прямо из resume-баннера, не заходя в
 *  неё. Зеркало cancelCardioAction — отменяет сессию и уводит на /workouts. */
export async function cancelWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const parsed = cancelSchema.safeParse({
    workoutId: formData.get("workoutId"),
  });
  if (!parsed.success) throw new Error("Invalid workoutId");
  await cancelWorkout(user.id, parsed.data.workoutId);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  redirect("/workouts");
}

export async function deleteWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));
  if (!workoutId) throw new Error("Missing workoutId");
  await deleteWorkout(user.id, workoutId);
  revalidatePath("/workouts");
  revalidatePath("/dashboard");
  redirect("/workouts");
}
