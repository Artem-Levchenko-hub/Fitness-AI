import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  AI_QUOTA_EXCHANGE,
  aiQuotaBucketStart,
  buildAiQuotaOverview,
  canExchangeAiQuota,
  type AiQuotaOverview,
  type AiQuotaUsage,
} from "@/lib/billing/ai-quota-policy";
import { getBillingPlan, hasActiveProAccess } from "@/lib/billing/plans";

const COUNTED_USAGE_STATUSES = ["processing", "succeeded"] as const;

type UsageRow = { operation: string; total: number };

function usageFromRows(rows: readonly UsageRow[]): AiQuotaUsage {
  const totals = new Map(rows.map((row) => [row.operation, row.total]));
  return {
    postWorkoutAnalyses: totals.get("post_workout_analysis") ?? 0,
    coachReplies: totals.get("coach_reply") ?? 0,
    progressSummaries:
      (totals.get("weekly_review") ?? 0) +
      (totals.get("daily_digest") ?? 0),
    oneShotAiOperations: totals.get("one_shot") ?? 0,
  };
}

export async function getAiQuotaOverview(
  userId: string,
  now = new Date(),
): Promise<AiQuotaOverview | null> {
  const bucketStart = aiQuotaBucketStart(now);
  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  if (!subscription || !hasActiveProAccess(subscription, now)) return null;

  const [exchange, usageRows] = await Promise.all([
    db
      .select({ id: schema.aiQuotaExchanges.id })
      .from(schema.aiQuotaExchanges)
      .where(
        and(
          eq(schema.aiQuotaExchanges.userId, userId),
          eq(schema.aiQuotaExchanges.bucketStart, bucketStart),
        ),
      )
      .limit(1),
    db
      .select({
        operation: schema.aiUsageLedger.operation,
        total: count(),
      })
      .from(schema.aiUsageLedger)
      .where(
        and(
          eq(schema.aiUsageLedger.userId, userId),
          eq(schema.aiUsageLedger.bucketStart, bucketStart),
          eq(schema.aiUsageLedger.countsTowardQuota, true),
          inArray(schema.aiUsageLedger.status, COUNTED_USAGE_STATUSES),
        ),
      )
      .groupBy(schema.aiUsageLedger.operation),
  ]);

  return buildAiQuotaOverview(
    getBillingPlan(subscription.planCode ?? "pro_monthly").quotas,
    usageFromRows(usageRows),
    exchange.length > 0,
    bucketStart,
  );
}

export type ExchangeAiQuotaResult =
  | { kind: "exchanged"; overview: AiQuotaOverview }
  | { kind: "already_exchanged"; overview: AiQuotaOverview }
  | { kind: "insufficient_questions"; overview: AiQuotaOverview }
  | { kind: "subscription_required" };

/** Atomically converts 20 still-unused coach replies into 10 analyses.
 * claimAiCapacity locks the same users row, so a concurrent coach request
 * cannot consume the twentieth remaining reply between check and insert. */
export async function exchangeAiQuota(
  userId: string,
  now = new Date(),
): Promise<ExchangeAiQuotaResult> {
  const bucketStart = aiQuotaBucketStart(now);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .for("update")
      .limit(1);
    if (!user) throw new Error("AI quota user not found");

    const [subscription] = await tx
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .for("update")
      .limit(1);
    if (!subscription || !hasActiveProAccess(subscription, now)) {
      return { kind: "subscription_required" as const };
    }

    const [existing] = await tx
      .select({ id: schema.aiQuotaExchanges.id })
      .from(schema.aiQuotaExchanges)
      .where(
        and(
          eq(schema.aiQuotaExchanges.userId, userId),
          eq(schema.aiQuotaExchanges.bucketStart, bucketStart),
        ),
      )
      .limit(1);

    const usageRows = await tx
      .select({
        operation: schema.aiUsageLedger.operation,
        total: count(),
      })
      .from(schema.aiUsageLedger)
      .where(
        and(
          eq(schema.aiUsageLedger.userId, userId),
          eq(schema.aiUsageLedger.bucketStart, bucketStart),
          eq(schema.aiUsageLedger.countsTowardQuota, true),
          inArray(schema.aiUsageLedger.status, COUNTED_USAGE_STATUSES),
        ),
      )
      .groupBy(schema.aiUsageLedger.operation);
    const used = usageFromRows(usageRows);
    const plan = getBillingPlan(subscription.planCode ?? "pro_monthly");

    if (existing) {
      return {
        kind: "already_exchanged" as const,
        overview: buildAiQuotaOverview(plan.quotas, used, true, bucketStart),
      };
    }
    if (!canExchangeAiQuota(plan.quotas, used.coachReplies, false)) {
      return {
        kind: "insufficient_questions" as const,
        overview: buildAiQuotaOverview(plan.quotas, used, false, bucketStart),
      };
    }

    const [created] = await tx
      .insert(schema.aiQuotaExchanges)
      .values({
        userId,
        bucketStart,
        coachRepliesSpent: AI_QUOTA_EXCHANGE.coachRepliesSpent,
        postWorkoutAnalysesAdded:
          AI_QUOTA_EXCHANGE.postWorkoutAnalysesAdded,
      })
      .onConflictDoNothing()
      .returning({ id: schema.aiQuotaExchanges.id });

    return {
      kind: created ? ("exchanged" as const) : ("already_exchanged" as const),
      overview: buildAiQuotaOverview(plan.quotas, used, true, bucketStart),
    };
  });
}
