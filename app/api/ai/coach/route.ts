import { streamText } from "ai";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { buildCoachContext } from "@/lib/ai/context-builder";
import { gemini, GEMINI_CHAT_MODEL, isGeminiConfigured } from "@/lib/ai/gemini";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  formatRetrievedChunks,
  retrieveRelevant,
} from "@/lib/ai/rag/retrieve";
import { aiCoachPriceKopecks } from "@/lib/billing/pricing";
import { debit } from "@/lib/repos/credits.repo";

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

  if (!isGeminiConfigured()) {
    return new Response(
      "AI-коуч пока выключен — администратор не настроил GEMINI_API_KEY.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Списание credits только при ПЕРВОМ user-сообщении сессии. Дальнейшие
  // сообщения этой беседы — бесплатно (один разговор = один debit).
  const userMessages = parsed.messages.filter((m) => m.role === "user");
  if (userMessages.length === 1) {
    const price = aiCoachPriceKopecks();
    const debitResult = await debit(
      user.id,
      price,
      `AI-коуч: разбор тренировки`,
      { id: parsed.workoutId, type: "ai_coach_session" },
    );
    if (!debitResult.ok) {
      return Response.json(
        {
          error: "insufficient_funds",
          message: `Недостаточно баланса. Пополните на странице /billing — анализ стоит ${price / 100} ₽.`,
          balance: debitResult.balance,
          priceKopecks: price,
        },
        { status: 402 },
      );
    }
  }

  const athleteContext = await buildCoachContext(user.id, parsed.workoutId);

  // RAG: retrieve по последнему user-сообщению. На первом сообщении —
  // ищем по описанию сегодняшней тренировки (канон подбирается под неё).
  const lastUserMsg =
    [...parsed.messages].reverse().find((m) => m.role === "user")?.content ??
    "";
  const ragQuery =
    userMessages.length === 1
      ? `${lastUserMsg}\n\n${athleteContext.slice(0, 1500)}`
      : lastUserMsg;

  let canonContext: string;
  try {
    const chunks = await retrieveRelevant(ragQuery, { topK: 6 });
    canonContext = formatRetrievedChunks(chunks);
  } catch (e) {
    console.error("[coach] RAG retrieve failed:", e);
    canonContext =
      "_(не удалось обратиться к базе знаний — отвечай только на основе истории атлета и явно скажи об этом)_";
  }

  const result = streamText({
    model: gemini(GEMINI_CHAT_MODEL),
    system: `${COACH_SYSTEM_PROMPT}\n\n---\n\n## Контекст из канона (загруженная литература)\n\n${canonContext}\n\n---\n\n## Контекст атлета\n\n${athleteContext}`,
    messages: parsed.messages,
    abortSignal: AbortSignal.timeout(45_000),
    temperature: 0.3,
  });

  return result.toTextStreamResponse();
}
