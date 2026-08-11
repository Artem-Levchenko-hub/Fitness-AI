import { createHash } from "node:crypto";

import { stepCountIs, streamText } from "ai";
import { z } from "zod";

import { buildTrainerContext } from "@/lib/ai/context-builder";
import { createCoachTools } from "@/lib/ai/coach-tools";
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
import { fitCoachMessagesForModel } from "@/lib/domain/ai/coach-conversation";
import {
  claimCoachBillingOperation,
  completeAiBillingOperation,
  failAndRefundAiBillingOperation,
  type ClaimAiBillingOperation,
} from "@/lib/repos/ai-billing.repo";
import {
  appendCoachMessage,
  CoachMessageConflictError,
  listCoachMessages,
} from "@/lib/repos/coach-conversations.repo";
import { hasActiveProSubscription } from "@/lib/repos/subscriptions.repo";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  workoutId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  message: z.string().trim().min(1).max(8_000),
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
        clientMessageId: parsed.clientMessageId,
        message: parsed.message,
      }),
    )
    .digest("hex");
  const assistantMessageId = createHash("sha256")
    .update(`coach-reply:${operationId}`)
    .digest("hex");

  const persistAssistantReply = async (content: string) => {
    if (!content.trim()) throw new Error("empty_coach_reply");
    await appendCoachMessage(user.id, parsed.workoutId, {
      id: assistantMessageId,
      role: "assistant",
      content,
    });
  };

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
  let cachedResponseText: string | null = null;
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
      cachedResponseText = result.responseText;
    } else if (result.kind === "in_progress") {
      return Response.json(
        {
          error: "request_in_progress",
          message: "Этот вопрос уже обрабатывается.",
        },
        { status: 409 },
      );
    } else if (result.kind === "insufficient_funds") {
      return Response.json(
        {
          error: "insufficient_funds",
          message: `Недостаточно баланса. Один ответ стоит ${result.priceKopecks / 100} ₽.`,
          balance: result.balance,
          priceKopecks: result.priceKopecks,
        },
        { status: 402 },
      );
    } else {
      claim = result;
    }
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

  // Persist only accepted/billable turns. A rejected request must not allow
  // unbounded history writes that bypass capacity and billing limits.
  try {
    await appendCoachMessage(user.id, parsed.workoutId, {
      id: parsed.clientMessageId,
      role: "user",
      content: parsed.message,
    });
  } catch (error) {
    if (error instanceof CoachMessageConflictError) {
      await failOperation("message_id_conflict");
      return Response.json({ error: "message_id_conflict" }, { status: 409 });
    }
    console.error("[coach] user message persistence failed", error);
    await failOperation("conversation_persist_failed");
    return Response.json({ error: "conversation_unavailable" }, { status: 503 });
  }

  if (cachedResponseText !== null) {
    await persistAssistantReply(cachedResponseText);
    return new Response(cachedResponseText, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let messages: Array<{ role: "user" | "assistant"; content: string }>;
  try {
    messages = fitCoachMessagesForModel(
      await listCoachMessages(user.id, parsed.workoutId, 64),
    ).map(({ role, content }) => ({ role, content }));
  } catch (error) {
    console.error("[coach] conversation load failed", error);
    await failOperation("conversation_load_failed");
    return Response.json({ error: "conversation_unavailable" }, { status: 503 });
  }

  let athleteContext: string;
  try {
    athleteContext = (
      await buildTrainerContext(user.id, parsed.workoutId, { kind: "on_demand" })
    ).prompt;
  } catch {
    await failOperation("context_build_failed");
    return Response.json({ error: "context_unavailable" }, { status: 503 });
  }

  const userMessages = messages.filter((message) => message.role === "user");
  const lastUserMessage =
    [...messages].reverse().find((message) => message.role === "user")
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
      system: `${COACH_SYSTEM_PROMPT}\n\n## Оркестрация и действия\n\nТы подключён к реальным данным приложения. Когда нужен ID шаблона, упражнения или активной тренировки — сначала используй соответствующий инструмент чтения. Изменяй шаблон, записывай подход, доп. активность или заметку только после явной просьбы атлета сделать это; совет сам по себе не является фактом и не должен записываться. После успешного действия кратко подтверди, что именно сохранено, с цифрами. Не выдумывай выполненные подходы, веса, повторы, сон или питание. Для Myo-reps сохраняй протокол как Myo-reps, а в анализе учитывай его как сопоставимый тренировочный объём, не смешивая активацию и мини-сеты в обычные подходы один к одному.\n\n---\n\n## Контекст из канона (загруженная литература)\n\n${canonContext}\n\n---\n\n## Контекст атлета\n\n${athleteContext}`,
      messages,
      tools: createCoachTools(user.id, parsed.workoutId),
      stopWhen: stepCountIs(5),
      abortSignal: AbortSignal.timeout(45_000),
      temperature: 0.3,
      maxOutputTokens: 4_096,
      onFinish: async ({ text }) => {
        try {
          await persistAssistantReply(text);
          if (usageId) await settleAiCapacity(usageId, true);
          if (claim) await completeAiBillingOperation(operationId, text);
        } catch (error) {
          console.error("[coach] assistant message persistence failed", {
            operationId,
            error,
          });
          await failOperation("conversation_persist_failed");
        }
      },
      onError: async () => {
        await failOperation("provider_stream_failed");
      },
    });
    // Remove response backpressure: generation and onFinish must complete even
    // when a phone refreshes, goes offline, or closes the page mid-answer.
    result.consumeStream();
    return result.toTextStreamResponse();
  } catch {
    await failOperation("provider_start_failed");
    return Response.json({ error: "ai_provider_failed" }, { status: 502 });
  }
}
