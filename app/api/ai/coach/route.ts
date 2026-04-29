import { streamText } from "ai";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { buildCoachContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  messages: z.array(messageSchema).min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return new Response(
      "AI-коуч пока выключен — администратор не настроил AI_API_KEY.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const context = await buildCoachContext(user.id, parsed.workoutId);

  const result = streamText({
    model: aiClient(COACH_MODEL),
    system: `${COACH_SYSTEM_PROMPT}\n\n---\n\n## Контекст атлета\n\n${context}`,
    messages: parsed.messages,
    abortSignal: AbortSignal.timeout(45_000),
    temperature: 0.6,
  });

  // Plain text stream — client манипулирует сам, без DataStream protocol.
  return result.toTextStreamResponse();
}
