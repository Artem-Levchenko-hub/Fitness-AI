import { generateText } from "ai";
import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/require-user";
import { buildCoachContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { FINALIZE_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  /** Полная история диалога: alternating user/assistant. */
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1),
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

  // Уже сохранён?
  const [existing] = await db
    .select({ id: schema.aiAnalyses.id })
    .from(schema.aiAnalyses)
    .where(eq(schema.aiAnalyses.workoutId, parsed.workoutId))
    .limit(1);

  if (existing) {
    return Response.json({ alreadyFinalized: true, id: existing.id });
  }

  const context = await buildCoachContext(user.id, parsed.workoutId);
  const transcript = parsed.messages
    .map((m) => `**${m.role}:** ${m.content}`)
    .join("\n\n");

  let summaryText: string;
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;

  try {
    const result = await generateText({
      model: aiClient(COACH_MODEL),
      system: `${FINALIZE_SYSTEM_PROMPT}\n\n---\n\n## Контекст\n\n${context}`,
      prompt: `## Транскрипт разговора\n\n${transcript}\n\nСделай итог.`,
      abortSignal: AbortSignal.timeout(45_000),
      temperature: 0.4,
    });
    summaryText = result.text;
    promptTokens = result.usage?.inputTokens ?? null;
    completionTokens = result.usage?.outputTokens ?? null;
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "AI summarization failed",
      },
      { status: 502 },
    );
  }

  // Транзакционно сохраняем: ai_analyses + workout_notes (auto-generated)
  const result = await db.transaction(async (tx) => {
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

    // Append summary в workout_notes (создаём если нет)
    const [existingNote] = await tx
      .select({ id: schema.workoutNotes.id, content: schema.workoutNotes.content })
      .from(schema.workoutNotes)
      .where(eq(schema.workoutNotes.workoutId, parsed.workoutId))
      .limit(1);

    if (existingNote) {
      await tx
        .update(schema.workoutNotes)
        .set({
          content: `${existingNote.content}\n\n## AI-анализ\n\n${summaryText}`.trim(),
          source: "auto_generated",
        })
        .where(eq(schema.workoutNotes.id, existingNote.id));
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

  return Response.json({ id: result?.id, content: summaryText });
}
