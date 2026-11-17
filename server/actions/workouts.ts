"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  cancelWorkout,
  deleteSet,
  deleteWorkout,
  recordSet,
  startWorkoutFromTemplate,
} from "@/lib/repos/workouts.repo";
import { getOrCreateNextWorkoutTemplate } from "@/lib/repos/plan-from-history.repo";
import { feelingNoteLine } from "@/lib/domain/workouts/feeling";
import { parseClientSetId } from "@/lib/domain/workouts/client-set-id";
import { parseClientWorkoutId } from "@/lib/domain/workouts/client-workout-id";
import { finishStrengthWorkout } from "@/server/finish-strength-workout";

const startSchema = z.object({
  templateId: z.string().uuid(),
});

/** «Начать скорректированную тренировку» прямо из истории: по завершённой
 *  тренировке тренер строит следующую с прогрессией (get-or-create шаблон
 *  source='trainer'), и мы стартуем по нему живую сессию. Работает и для ad-hoc
 *  тренировок без исходного шаблона. Нечего прогрессировать (нет рабочих
 *  подходов) → возврат в ту же тренировку. R-7: repo гейтят по userId. */
export async function startNextWorkoutAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!workoutId) throw new Error("Missing workoutId");

  const tpl = await getOrCreateNextWorkoutTemplate(user.id, workoutId);
  if (!tpl) redirect(`/workouts/${workoutId}`);

  const { id } = await startWorkoutFromTemplate(user.id, tpl.id);
  revalidatePath("/dashboard");
  revalidatePath("/workouts");
  redirect(`/workouts/${id}`);
}

export async function startWorkoutFromTemplateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) throw new Error("Invalid templateId");

  // H15.3c-2 — канонический ключ идемпотентного старта. Онлайн-форма шлёт свежий
  // makeClientId() на каждый сабмит; отсутствует/мусор → null → старый онлайн-путь
  // (clientWorkoutId NULL, столп 4). Под этим же ключом дренаж офлайн-старта (H15.4)
  // найдёт уже созданную тренировку и не сплодит дубль.
  const clientWorkoutId = parseClientWorkoutId(formData.get("clientWorkoutId"));
  const { id } = await startWorkoutFromTemplate(user.id, parsed.data.templateId, {
    clientWorkoutId,
  });
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

/** Результат одной формы используется для обычного финиша и фонового дренажа. */
async function finishWorkoutCore(formData: FormData): Promise<string> {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId"));
  if (!workoutId) throw new Error("Missing workoutId");

  const feeling = String(formData.get("feeling") ?? "").trim();
  // Pliability-тап «легко/норм/тяжело» (H11.3) — одно касание вместо набора.
  const feelingLine = feelingNoteLine(String(formData.get("feelingTag") ?? ""));

  // Самочувствие атлета → одна workout_note. Тап и/или свободный текст
  // объединяются в одну заметку (не плодим строки — context-builder берёт лишь
  // 4 свежих). source=auto_generated, если был только тап; manual, если атлет
  // что-то напечатал. AI-тренер читает заметки целиком при разборе.
  const content = [feelingLine, feeling].filter(Boolean).join("\n").slice(0, 1000);
  const result = await finishStrengthWorkout(user.id, workoutId, content ? {
    content,
    source: feeling ? "manual" : "auto_generated",
  } : undefined);
  if (result === "workout_not_found" || result === "workout_status_conflict") {
    throw new Error("Активная тренировка не найдена");
  }
  return workoutId;
}

export async function finishWorkoutAction(formData: FormData) {
  const workoutId = await finishWorkoutCore(formData);
  // Trainer (structured JSON оценка) — основной flow. Coach (диалог) теперь
  // вторичен, доступен через кнопку на trainer/completed-view. redirect throws
  // — держим вне try/catch (вне finishWorkoutCore).
  redirect(`/workouts/${workoutId}/trainer`);
}

/**
 * H15.4 — реплей офлайн-завершения при дренаже outbox. Та же логика финиша, но
 * БЕЗ redirect: фоновая синхронизация по событию `online` не должна навигировать
 * пользователя. Идемпотентно при двойном дренаже (см. finishWorkoutCore).
 */
export async function replayFinishWorkoutAction(
  formData: FormData,
): Promise<void> {
  await finishWorkoutCore(formData);
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
