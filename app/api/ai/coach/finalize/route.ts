import { createHash } from "node:crypto";

import { generateText } from "ai";
import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/require-user";
import { buildCoachContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { FINALIZE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  capacityDuplicateResponse,
  capacityErrorResponse,
  claimAiCapacity,
  requireOwnedWorkout,
  settleAiCapacity,
} from "@/lib/ai/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  /** Полная история диалога: alternating user/assistant. */
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8_000),
      }),
    )
    .min(1)
    .max(32)
    .refine(
      (messages) => messages.reduce((total, message) => total + message.content.length, 0) <= 24_000,
      "Transcript is too large",
    ),
});

export async function POST(request: Request) {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return Response.json(
      { error: "AI-коуч пока выключен" },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!(await requireOwnedWorkout(user.id, parsed.workoutId))) {
    return Response.json({ error: "workout_not_found" }, { status: 404 });
  }

  // Уже сохранён?
  const [existing] = await db
    .select({ id: schema.aiAnalyses.id })
    .from(schema.aiAnalyses)
    .where(and(eq(schema.aiAnalyses.workoutId, parsed.workoutId), eq(schema.aiAnalyses.userId, user.id)))
    .limit(1);

  if (existing) {
    return Response.json({ alreadyFinalized: true, id: existing.id });
  }

  const requestKey = createHash("sha256")
    .update(
      JSON.stringify({
        userId: user.id,
        workoutId: parsed.workoutId,
        messages: parsed.messages,
      }),
    )
    .digest("hex");
  const capacity = await claimAiCapacity({
    userId: user.id,
    operation: "post_workout_analysis",
    requestKey: `finalize:${requestKey}`,
  });
  if (capacity.kind === "duplicate") {
    return capacityDuplicateResponse(capacity);
  }
  if (capacity.kind !== "allowed") {
    return capacityErrorResponse(capacity);
  }
  const usageId = capacity.usageId;

  try {
    const context = await buildCoachContext(user.id, parsed.workoutId);
    const transcript = parsed.messages
      .map((m) => `**${m.role}:** ${m.content}`)
      .join("\n\n");

    const generated = await generateText({
      model: aiClient(COACH_MODEL),
      system: `${FINALIZE_SYSTEM_PROMPT}\n\n---\n\n## Контекст\n\n${context}`,
      prompt: `## Транскрипт разговора\n\n${transcript}\n\nСделай итог.`,
      abortSignal: AbortSignal.timeout(45_000),
      temperature: 0.4,
    });
    const summaryText = generated.text;
    const promptTokens = generated.usage?.inputTokens ?? null;
    const completionTokens = generated.usage?.outputTokens ?? null;

    // Транзакционно сохраняем: ai_analyses + workout_notes (auto-generated)
    const saved = await db.transaction(async (tx) => {
      const [analysis] = await tx
        .insert(schema.aiAnalyses)
        .values({
          userId: user.id,
          workoutId: parsed.workoutId,
          content: summaryText,
          modelVersion: COACH_MODEL,
          promptTokens,
          completionTokens,
        })
        .returning({ id: schema.aiAnalyses.id });

      const [existingNote] = await tx
        .select({
          id: schema.workoutNotes.id,
          content: schema.workoutNotes.content,
        })
        .from(schema.workoutNotes)
        .where(
          and(
            eq(schema.workoutNotes.workoutId, parsed.workoutId),
            eq(schema.workoutNotes.userId, user.id),
          ),
        )
        .limit(1);

      if (existingNote) {
        await tx
          .update(schema.workoutNotes)
          .set({
            content:
              `${existingNote.content}\n\n## AI-анализ\n\n${summaryText}`.trim(),
            source: "auto_generated",
          })
          .where(
            and(
              eq(schema.workoutNotes.id, existingNote.id),
              eq(schema.workoutNotes.userId, user.id),
            ),
          );
      } else {
        await tx.insert(schema.workoutNotes).values({
          userId: user.id,
          workoutId: parsed.workoutId,
          content: `## AI-анализ\n\n${summaryText}`,
          source: "auto_generated",
        });
      }

      return analysis;
    });

    if (!saved) throw new Error("Failed to save AI summary");
    await settleAiCapacity(usageId, true);
    return Response.json({ id: saved.id, content: summaryText });
  } catch (error) {
    await settleAiCapacity(usageId, false);
    console.error("[coach-finalize] generation or save failed:", error);
    return Response.json(
      { error: "AI summarization failed" },
      { status: 502 },
    );
  }
}
