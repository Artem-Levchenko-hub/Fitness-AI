import { createHash } from "node:crypto";

import { streamText } from "ai";
import { z } from "zod";

import { buildCoachContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  formatRetrievedChunks,
  retrieveRelevant,
} from "@/lib/ai/rag/retrieve";
import { requireUser } from "@/lib/auth/require-user";
import { isBillingEnabled } from "@/lib/billing/flags";
import { aiCoachPriceKopecks } from "@/lib/billing/pricing";
import {
  claimCoachBillingOperation,
  completeAiBillingOperation,
  failAndRefundAiBillingOperation,
  type ClaimAiBillingOperation,
} from "@/lib/repos/ai-billing.repo";
import { hasActiveProSubscription } from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  messages: z
    .array(messageSchema)
    .min(1)
    .max(40)
    .refine(
      (messages) => messages.some((message) => message.role === "user"),
      "At least one user message is required",
    )
    .refine(
      (messages) =>
        messages.reduce((total, message) => total + message.content.length, 0) <=
        80_000,
      "Conversation is too large",
    ),
});

export async function POST(request: Request) {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return new Response(
      "AI-тренер пока выключен — администратор не настроил AI-провайдера.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const parsedResult = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedResult.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = parsedResult.data;

  const operationId = createHash("sha256")
    .update(
      JSON.stringify({
        userId: user.id,
        workoutId: parsed.workoutId,
        messages: parsed.messages,
      }),
    )
    .digest("hex");

  let claim: Extract<ClaimAiBillingOperation, { kind: "claimed" }> | undefined;
  if (isBillingEnabled()) {
    const hasSubscription = await hasActiveProSubscription(user.id);
    const priceKopecks = hasSubscription ? 0 : aiCoachPriceKopecks();
    const result = await claimCoachBillingOperation({
      id: operationId,
      userId: user.id,
      workoutId: parsed.workoutId,
      coverage: hasSubscription ? "subscription" : "wallet",
      priceKopecks,
    });

    if (result.kind === "cached") {
      return new Response(result.responseText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (result.kind === "in_progress") {
      return Response.json(
        {
          error: "request_in_progress",
          message: "Этот вопрос уже обрабатывается.",
        },
        { status: 409 },
      );
    }
    if (result.kind === "insufficient_funds") {
      return Response.json(
        {
          error: "insufficient_funds",
          message: `Недостаточно баланса. Один ответ стоит ${result.priceKopecks / 100} ₽.`,
          balance: result.balance,
          priceKopecks: result.priceKopecks,
        },
        { status: 402 },
      );
    }
    claim = result;
  }

  const failOperation = async (code: string) => {
    if (!claim) return;
    try {
      await failAndRefundAiBillingOperation(operationId, code);
    } catch (error) {
      console.error("[coach] atomic operation refund failed", {
        operationId,
        error,
      });
    }
  };

  let athleteContext: string;
  try {
    athleteContext = await buildCoachContext(user.id, parsed.workoutId);
  } catch {
    await failOperation("context_build_failed");
    return Response.json({ error: "context_unavailable" }, { status: 503 });
  }

  const userMessages = parsed.messages.filter((message) => message.role === "user");
  const lastUserMessage =
    [...parsed.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";
  const ragQuery =
    userMessages.length === 1
      ? `${lastUserMessage}\n\n${athleteContext.slice(0, 1500)}`
      : lastUserMessage;

  let canonContext: string;
  try {
    const chunks = await retrieveRelevant(ragQuery, { topK: 6 });
    canonContext = formatRetrievedChunks(chunks);
  } catch (error) {
    console.error("[coach] RAG retrieve failed:", error);
    canonContext =
      "_(не удалось обратиться к базе знаний — отвечай только на основе истории атлета и явно скажи об этом)_";
  }

  try {
    const result = streamText({
      model: aiClient(COACH_MODEL),
      system: `${COACH_SYSTEM_PROMPT}\n\n---\n\n## Контекст из канона (загруженная литература)\n\n${canonContext}\n\n---\n\n## Контекст атлета\n\n${athleteContext}`,
      messages: parsed.messages,
      abortSignal: AbortSignal.timeout(45_000),
      temperature: 0.3,
      onFinish: async ({ text }) => {
        if (!claim) return;
        await completeAiBillingOperation(operationId, text);
      },
      onError: async () => {
        await failOperation("provider_stream_failed");
      },
    });
    return result.toTextStreamResponse();
  } catch {
    await failOperation("provider_start_failed");
    return Response.json({ error: "ai_provider_failed" }, { status: 502 });
  }
}
