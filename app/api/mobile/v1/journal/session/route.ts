import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { cancelWorkout, startMobileWorkoutFromTemplate } from "@/lib/repos/workouts.repo";
import { finishStrengthWorkout } from "@/server/finish-strength-workout";

import { journalJson as json } from "../response";

const accountId = z.string().min(1).max(128);
const sessionSchema = z.discriminatedUnion("action", [
  z.object({
    accountId,
    action: z.literal("start"),
    templateId: z.uuid(),
    clientWorkoutId: z.uuid().transform((id) => id.toLowerCase()),
  }),
  z.object({
    accountId,
    action: z.enum(["finish", "cancel"]),
    workoutId: z.uuid(),
  }),
]);

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "invalid_content_type" }, 415);

  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_session" }, 400);
  if (parsed.data.accountId !== user.id) return json({ error: "account_changed" }, 409);

  if (parsed.data.action === "start") {
    const { templateId, clientWorkoutId } = parsed.data;
    const result = await startMobileWorkoutFromTemplate(user.id, templateId, clientWorkoutId);
    if ("error" in result) {
      return json({ error: result.error }, result.error === "template_not_found" ? 404 : 409);
    }
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    return json({ workoutId: result.id });
  }

  const { action, workoutId } = parsed.data;
  const result = action === "finish"
    ? await finishStrengthWorkout(user.id, workoutId)
    : await cancelWorkout(user.id, workoutId);
  if (result === "workout_not_found") return json({ error: result }, 404);
  if (result === "workout_status_conflict") return json({ error: result }, 409);

  if (action === "cancel" && result === "changed") {
    revalidatePath(`/workouts/${workoutId}`);
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
  }
  return json({ workoutId });
}
