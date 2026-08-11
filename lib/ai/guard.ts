import "server-only";

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  aiQuotaBucketStart,
  effectiveAiQuotas,
  type EffectiveAiQuotas,
} from "@/lib/billing/ai-quota-policy";
import { getBillingPlan, hasActiveProAccess } from "@/lib/billing/plans";
import { postgresTimestampParameter } from "@/lib/billing/postgres-timestamp";

export const AI_OPERATIONS = [
  "coach_reply",
  "post_workout_analysis",
  "weekly_review",
  "daily_digest",
  "one_shot",
] as const;

export type AiOperation = (typeof AI_OPERATIONS)[number];

type CapacityResult =
  | { kind: "allowed"; usageId: string; countsTowardQuota: boolean }
  | {
      kind: "duplicate";
      usageId: string;
      status: "processing" | "succeeded";
      countsTowardQuota: boolean;
    }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "quota_exceeded"; message: string }
  | { kind: "subscription_required" };

const MAX_OPERATIONS_PER_MINUTE = 6;
const ACTIVE_USAGE_STATUSES = ["processing", "succeeded"] as const;

function quotaFor(operation: AiOperation, quotas: EffectiveAiQuotas) {
  switch (operation) {
    case "post_workout_analysis":
      return quotas.postWorkoutAnalyses;
    case "weekly_review":
    case "daily_digest":
      return quotas.progressSummaries;
    case "one_shot":
      return quotas.oneShotAiOperations;
    case "coach_reply":
      return quotas.coachReplies;
  }
}

/** Weekly/daily summaries share their own bucket. Workout analyses and coach
 * replies remain protected from all background operations. */
function quotaOperations(operation: AiOperation): readonly AiOperation[] {
  switch (operation) {
    case "weekly_review":
    case "daily_digest":
      return ["weekly_review", "daily_digest"];
    default:
      return [operation];
  }
}

/**
 * Единственная server-side точка допуска к LLM. Она блокирует burst-нагрузку,
 * применяет тарифные месячные квоты и сохраняет durable reservation до исхода
 * запроса. Блокировка строки users делает check+insert атомарным для одного
 * пользователя без глобального lock-а.
 */
export async function claimAiCapacity(input: {
  userId: string;
  operation: AiOperation;
  requestKey: string;
  /** Scope remains in the ledger for audit/idempotency; quota is global/monthly. */
  scopeKey?: string | null;
  /** Coach может оплачиваться из кошелька без Pro, но всё равно rate-limited. */
  allowWallet?: boolean;
  now?: Date;
}): Promise<CapacityResult> {
  const now = input.now ?? new Date();
  const bucketStart = aiQuotaBucketStart(now);
  const minuteStart = new Date(now.getTime() - 60_000);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user) throw new Error("AI capacity user not found");

    const [existing] = await tx
      .select({
        id: schema.aiUsageLedger.id,
        userId: schema.aiUsageLedger.userId,
        operation: schema.aiUsageLedger.operation,
        scopeKey: schema.aiUsageLedger.scopeKey,
        status: schema.aiUsageLedger.status,
        countsTowardQuota: schema.aiUsageLedger.countsTowardQuota,
        updatedAt: schema.aiUsageLedger.updatedAt,
      })
      .from(schema.aiUsageLedger)
      .where(eq(schema.aiUsageLedger.requestKey, input.requestKey))
      .limit(1);
    if (existing) {
      if (
        existing.userId !== input.userId ||
        existing.operation !== input.operation ||
        existing.scopeKey !== (input.scopeKey ?? null)
      ) {
        throw new Error("AI capacity request key ownership mismatch");
      }
      if (existing.status !== "failed") {
        return {
          kind: "duplicate" as const,
          usageId: existing.id,
          status: existing.status,
          countsTowardQuota: existing.countsTowardQuota,
        };
      }
      // Одна mutable reservation не должна превращаться в обход burst-limit:
      // после неудачи тот же requestKey можно реактивировать не чаще раза в
      // минуту. Остальные ключи по-прежнему считаются общим запросом ниже.
      if (existing.updatedAt >= minuteStart) {
        return { kind: "rate_limited" as const, retryAfterSeconds: 60 };
      }
    }

    const [recent] = await tx
      .select({ total: count() })
      .from(schema.aiUsageLedger)
      .where(
        and(
          eq(schema.aiUsageLedger.userId, input.userId),
          gte(schema.aiUsageLedger.createdAt, minuteStart),
        ),
      );
    if ((recent?.total ?? 0) >= MAX_OPERATIONS_PER_MINUTE) {
      return { kind: "rate_limited" as const, retryAfterSeconds: 60 };
    }

    const [subscription] = await tx
      .select({
        planCode: schema.subscriptions.planCode,
        tier: schema.subscriptions.tier,
        status: schema.subscriptions.status,
        currentPeriodStart: schema.subscriptions.currentPeriodStart,
        currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, input.userId))
      .limit(1);
    const hasPro = subscription
      ? hasActiveProAccess(subscription, now)
      : false;
    if (!hasPro && !input.allowWallet) return { kind: "subscription_required" as const };

    if (hasPro) {
      const plan = getBillingPlan(subscription?.planCode ?? "pro_monthly");
      const [exchange] = await tx
        .select({ id: schema.aiQuotaExchanges.id })
        .from(schema.aiQuotaExchanges)
        .where(
          and(
            eq(schema.aiQuotaExchanges.userId, input.userId),
            eq(schema.aiQuotaExchanges.bucketStart, bucketStart),
          ),
        )
        .limit(1);
      const quotas = effectiveAiQuotas(plan.quotas, Boolean(exchange));
      const quota = quotaFor(input.operation, quotas);
      const commonConditions = [
        eq(schema.aiUsageLedger.userId, input.userId),
        inArray(
          schema.aiUsageLedger.operation,
          quotaOperations(input.operation),
        ),
        eq(schema.aiUsageLedger.bucketStart, bucketStart),
        eq(schema.aiUsageLedger.countsTowardQuota, true),
        inArray(schema.aiUsageLedger.status, ACTIVE_USAGE_STATUSES),
      ];
      const [used] = await tx
        .select({ total: count() })
        .from(schema.aiUsageLedger)
        .where(and(...commonConditions));
      if ((used?.total ?? 0) >= quota) {
        return {
          kind: "quota_exceeded" as const,
          message:
            input.operation === "coach_reply"
              ? "Лимит вопросов AI-тренеру на этот месяц исчерпан."
              : input.operation === "post_workout_analysis"
                ? "Лимит разборов тренировок на этот месяц исчерпан."
                : "Лимит AI-операций по вашему тарифу на этот месяц исчерпан.",
        };
      }
    }

    if (existing) {
      const [reopened] = await tx
        .update(schema.aiUsageLedger)
        .set({
          status: "processing",
          bucketStart,
          countsTowardQuota: hasPro,
          createdAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.aiUsageLedger.id, existing.id),
            eq(schema.aiUsageLedger.status, "failed"),
          ),
        )
        .returning({ id: schema.aiUsageLedger.id });
      if (!reopened) {
        return {
          kind: "duplicate" as const,
          usageId: existing.id,
          status: "processing" as const,
          countsTowardQuota: existing.countsTowardQuota,
        };
      }
      return {
        kind: "allowed" as const,
        usageId: reopened.id,
        countsTowardQuota: hasPro,
      };
    }

    const [created] = await tx
      .insert(schema.aiUsageLedger)
      .values({
        userId: input.userId,
        operation: input.operation,
        requestKey: input.requestKey,
        scopeKey: input.scopeKey ?? null,
        bucketStart,
        countsTowardQuota: hasPro,
        status: "processing",
      })
      .returning({ id: schema.aiUsageLedger.id });
    if (!created) throw new Error("Failed to reserve AI capacity");
    return {
      kind: "allowed" as const,
      usageId: created.id,
      countsTowardQuota: hasPro,
    };
  });
}

export async function settleAiCapacity(usageId: string, succeeded: boolean): Promise<void> {
  await db
    .update(schema.aiUsageLedger)
    .set({ status: succeeded ? "succeeded" : "failed", updatedAt: new Date() })
    .where(and(eq(schema.aiUsageLedger.id, usageId), eq(schema.aiUsageLedger.status, "processing")));
}

/** Releases reservations abandoned by a crashed/disconnected AI request.
 * Every AI route has a <=60s timeout, so five minutes cannot overlap a valid
 * operation. Failed rows stop consuming monthly quota and remain auditable. */
export async function releaseStaleAiCapacity(before: Date): Promise<number> {
  const beforeIso = postgresTimestampParameter(before);
  const released = await db
    .update(schema.aiUsageLedger)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(schema.aiUsageLedger.status, "processing"),
        sql`${schema.aiUsageLedger.updatedAt} <= ${beforeIso}::timestamptz`,
      ),
    )
    .returning({ id: schema.aiUsageLedger.id });
  return released.length;
}

export function capacityErrorResponse(result: Exclude<CapacityResult, { kind: "allowed" } | { kind: "duplicate" }>) {
  if (result.kind === "rate_limited") {
    return Response.json({ error: "ai_rate_limited", retryAfterSeconds: result.retryAfterSeconds }, { status: 429 });
  }
  if (result.kind === "subscription_required") {
    return Response.json({ error: "subscription_required" }, { status: 403 });
  }
  return Response.json({ error: "ai_quota_exceeded", message: result.message }, { status: 429 });
}

export function capacityDuplicateResponse(
  result: Extract<CapacityResult, { kind: "duplicate" }>,
) {
  const processing = result.status === "processing";
  return Response.json(
    {
      error: processing ? "ai_request_in_progress" : "ai_request_completed",
      message: processing
        ? "Этот AI-запрос уже обрабатывается."
        : "Этот AI-запрос уже был выполнен.",
    },
    {
      status: 409,
      headers: processing ? { "Retry-After": "5" } : undefined,
    },
  );
}

export async function requireOwnedWorkout(userId: string, workoutId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.workouts.id })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.id, workoutId), eq(schema.workouts.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function requireOwnedCircuitWorkout(userId: string, circuitWorkoutId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.circuitWorkouts.id })
    .from(schema.circuitWorkouts)
    .where(and(eq(schema.circuitWorkouts.id, circuitWorkoutId), eq(schema.circuitWorkouts.userId, userId)))
    .limit(1);
  return Boolean(row);
}
