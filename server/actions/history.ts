"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { deleteCardio } from "@/lib/repos/cardio.repo";
import { deleteCircuit } from "@/lib/repos/circuits.repo";
import { deleteWorkout } from "@/lib/repos/workouts.repo";

/** Единый диспетчер удаления из ленты «История» (силовая/круговая/кардио).
 *  В отличие от detail-экшенов (`deleteWorkoutAction` и т.п.), НЕ редиректит —
 *  свайп вызывается прямо из ленты, навигация не нужна; ревалидация перерисует
 *  серверные ленты и строка исчезнет на месте. Удаление физическое: дочерние
 *  строки (подходы/раунды/блоки, AI-разбор, заметки) уходят по FK CASCADE, а
 *  значит сессия перестаёт учитываться во всех агрегатах статы (фильтр
 *  `status = "completed"` + отсутствие строки). Каждый repo фильтрует по
 *  userId (R-7) — чужую сессию не удалить. */
const deleteSchema = z.object({
  kind: z.enum(["strength", "circuit", "cardio"]),
  id: z.string().uuid(),
});

export async function deleteHistoryItemAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteSchema.safeParse({
    kind: formData.get("kind"),
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Некорректный элемент истории");

  const { kind, id } = parsed.data;
  if (kind === "strength") await deleteWorkout(user.id, id);
  else if (kind === "circuit") await deleteCircuit(user.id, id);
  else await deleteCardio(user.id, id);

  revalidatePath("/workouts");
  revalidatePath("/dashboard");
}
