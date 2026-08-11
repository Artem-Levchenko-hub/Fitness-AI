import type { BillingPlanQuotas } from "./plans";

export const AI_QUOTA_EXCHANGE = {
  coachRepliesSpent: 20,
  postWorkoutAnalysesAdded: 10,
} as const;

export type EffectiveAiQuotas = Readonly<{
  postWorkoutAnalyses: number;
  coachReplies: number;
  progressSummaries: number;
  oneShotAiOperations: number;
}>;

export type AiQuotaUsage = Readonly<{
  postWorkoutAnalyses: number;
  coachReplies: number;
  progressSummaries: number;
  oneShotAiOperations: number;
}>;

export type AiQuotaOverview = Readonly<{
  bucketStart: string;
  limits: EffectiveAiQuotas;
  used: AiQuotaUsage;
  remaining: AiQuotaUsage;
  exchange: Readonly<{
    completed: boolean;
    available: boolean;
    coachRepliesSpent: number;
    postWorkoutAnalysesAdded: number;
  }>;
}>;

export function aiQuotaBucketStart(now: Date): Date {
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("Expected a valid Date");
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function effectiveAiQuotas(
  base: BillingPlanQuotas,
  exchanged: boolean,
): EffectiveAiQuotas {
  return {
    postWorkoutAnalyses:
      base.postWorkoutAnalyses +
      (exchanged ? AI_QUOTA_EXCHANGE.postWorkoutAnalysesAdded : 0),
    coachReplies:
      base.coachReplies -
      (exchanged ? AI_QUOTA_EXCHANGE.coachRepliesSpent : 0),
    progressSummaries: base.progressSummaries,
    oneShotAiOperations: base.oneShotAiOperations,
  };
}

export function canExchangeAiQuota(
  base: BillingPlanQuotas,
  coachRepliesUsed: number,
  alreadyExchanged: boolean,
): boolean {
  return (
    !alreadyExchanged &&
    coachRepliesUsed <= base.coachReplies - AI_QUOTA_EXCHANGE.coachRepliesSpent
  );
}

export function buildAiQuotaOverview(
  base: BillingPlanQuotas,
  used: AiQuotaUsage,
  exchanged: boolean,
  bucketStart: Date,
): AiQuotaOverview {
  const limits = effectiveAiQuotas(base, exchanged);
  return {
    bucketStart: bucketStart.toISOString(),
    limits,
    used,
    remaining: {
      postWorkoutAnalyses: Math.max(
        0,
        limits.postWorkoutAnalyses - used.postWorkoutAnalyses,
      ),
      coachReplies: Math.max(0, limits.coachReplies - used.coachReplies),
      progressSummaries: Math.max(
        0,
        limits.progressSummaries - used.progressSummaries,
      ),
      oneShotAiOperations: Math.max(
        0,
        limits.oneShotAiOperations - used.oneShotAiOperations,
      ),
    },
    exchange: {
      completed: exchanged,
      available: canExchangeAiQuota(base, used.coachReplies, exchanged),
      ...AI_QUOTA_EXCHANGE,
    },
  };
}
