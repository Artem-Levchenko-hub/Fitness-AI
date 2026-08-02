import { createHash } from "node:crypto";

import { streamText } from "ai";
import { z } from "zod";

import { buildCoachContext } from "@/lib/ai/context-builder";
import { aiClient, COACH_MODEL, isAiConfigured } from "@/lib/ai/deepseek";
import { COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  capacityDuplicateResponse,
  capacityErrorResponse,
  claimAiCapacity,
  requireOwnedWorkout,
  settleAiCapacity,
} from "@/lib/ai/guard";
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
  content: z.string().trim().min(1).max(8_000),
});

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  messages: z
    .array(messageSchema)
    .min(1)
    .max(32)
    .refine(
      (messages) => messages.some((message) => message.role === "user"),
      "At least one user message is required",
    )
    .refine(
      (messages) =>
        messages.reduce((total, message) => total + message.content.length, 0) <=
        24_000,
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

  if (!(await requireOwnedWorkout(user.id, parsed.workoutId))) {
    return Response.json({ error: "workout_not_found" }, { status: 404 });
  }

  const operationId = createHash("sha256")
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
    operation: "coach_reply",
    requestKey: `coach:${operationId}`,
    scopeKey: parsed.workoutId,
    allowWallet: true,
  });
  if (capacity.kind !== "allowed" && capacity.kind !== "duplicate") {
    return capacityErrorResponse(capacity);
  }
  // При включённом биллинге durable billing-operation безопасно возвращает
  // cached/in-progress и не допускает двойное списание/генерацию. Без него
  // дубликат нельзя пропускать к LLM.
  if (capacity.kind === "duplicate" && !isBillingEnabled()) {
    return capacityDuplicateResponse(capacity);
  }
  const usageId = capacity.kind === "allowed" ? capacity.usageId : null;

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
    if (usageId) await settleAiCapacity(usageId, false);
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
        if (usageId) await settleAiCapacity(usageId, true);
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
