import { after } from "next/server";

import { env } from "@/lib/env";
import { finishCircuit } from "@/lib/repos/circuits.repo";

export async function finishCircuitWorkout(userId: string, workoutId: string, notes?: string | null) {
  const result = await finishCircuit(userId, workoutId, notes);
  const cronSecret = env.CRON_SECRET;
  if (result === "changed" && cronSecret) {
    after(async () => {
      try {
        await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/cron/process-ai-jobs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
      } catch {
        // Штатный cron подберёт уже сохранённую задачу.
      }
    });
  }
  return result;
}
