import { streamText } from "ai";
import { z } from "zod";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { requireUser } from "@/lib/auth/require-user";
import { buildTrainerContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { TRAINER_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  formatRetrievedChunks,
  retrieveRelevant,
} from "@/lib/ai/rag/retrieve";
import {
  FRAME_REASONING,
  FRAME_TEXT,
  STREAM_FRAME,
} from "@/lib/ai/trainer-stream-parse";
import {
  JSON_SHAPE_INSTRUCTION,
  parseTrainerJson,
  renderTrainerMarkdown,
  TRAINER_MODEL,
} from "@/lib/ai/trainer-structured";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  workoutId: z.string().uuid(),
});

/** Live-стрим разбора тренировки (F8-B). В отличие от cron-воркера (poll),
 *  генерация идёт прямо в этом запросе и токены льются клиенту. По завершении
 *  (onFinish) сырой ответ парсится в structured TrainerResponse и сохраняется
 *  в ai_analyses — те же цветные дельты, что и в poll-пути. */
export async function POST(request: Request) {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return new Response(
      "AI-тренер пока выключен — администратор не настроил AI_API_KEY.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const context = await buildTrainerContext(user.id, parsed.workoutId, {
    kind: "on_demand",
    circuitWorkoutId: null,
  });

  // RAG: канон под контекст тренировки (тот же паттерн, что в cron-воркере).
  let canonContext: string;
  try {
    const chunks = await retrieveRelevant(context.prompt.slice(0, 1200), {
      topK: 4,
    });
    canonContext = formatRetrievedChunks(chunks);
  } catch (e) {
    console.error("[trainer-stream] RAG retrieve failed:", e);
    canonContext =
      "_(база знаний недоступна — отвечай только на основе цифр атлета и явно скажи об этом)_";
  }

  const userPrompt = `## Контекст из канона (загруженная литература)

${canonContext}

---

${context.prompt}`;

  const result = streamText({
    model: aiClient(COACH_MODEL),
    system: `${TRAINER_SYSTEM_PROMPT}\n\n${JSON_SHAPE_INSTRUCTION}`,
    prompt: userPrompt,
    temperature: 0.4,
    // Только timeout (не request.signal): если клиент уйдёт со страницы,
    // генерация всё равно завершится и сохранит разбор.
    abortSignal: AbortSignal.timeout(45_000),
    onFinish: async ({ text, usage }) => {
      if (!text) return;
      try {
        const json = parseTrainerJson(text);
        await db.insert(schema.aiAnalyses).values({
          userId: user.id,
          workoutId: parsed.workoutId,
          content: renderTrainerMarkdown(json),
          resultJson: json as object,
          modelVersion: TRAINER_MODEL,
          promptTokens: usage?.inputTokens ?? null,
          completionTokens: usage?.outputTokens ?? null,
        });
      } catch (e) {
        console.error("[trainer-stream] save analysis failed:", e);
      }
    },
  });

  // Кадрируем поток: текст ответа (JSON) и «мысли» модели (reasoning) — две
  // дорожки в одном text-стриме (см. splitTrainerStream). Клиент льёт JSON в
  // живой разбор, а reasoning — в тикер «тренер размышляет». Reasoning есть не
  // у всех провайдеров (best-effort) — если его нет, идёт только текст.
  // Потребление fullStream до конца дотягивает генерацию → onFinish сохраняет.
  const encoder = new TextEncoder();
  const framed = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            controller.enqueue(
              encoder.encode(STREAM_FRAME + FRAME_TEXT + part.text),
            );
          } else if (part.type === "reasoning-delta") {
            controller.enqueue(
              encoder.encode(STREAM_FRAME + FRAME_REASONING + part.text),
            );
          }
        }
      } catch (err) {
        console.error("[trainer-stream] fullStream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(framed, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
