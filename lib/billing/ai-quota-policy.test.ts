import { describe, expect, it } from "vitest";

import {
  AI_QUOTA_EXCHANGE,
  aiQuotaBucketStart,
  buildAiQuotaOverview,
  canExchangeAiQuota,
  effectiveAiQuotas,
} from "./ai-quota-policy";
import { BILLING_PLANS } from "./plans";

describe("AI subscription quota policy", () => {
  const base = BILLING_PLANS.pro_monthly.quotas;

  it("keeps workout analyses and coach replies independent", () => {
    expect(effectiveAiQuotas(base, false)).toEqual({
      postWorkoutAnalyses: 15,
      coachReplies: 60,
      progressSummaries: 20,
      oneShotAiOperations: 10,
    });
  });

  it("exchanges 20 replies for 10 analyses exactly once", () => {
    expect(effectiveAiQuotas(base, true)).toEqual({
      postWorkoutAnalyses: 25,
      coachReplies: 40,
      progressSummaries: 20,
      oneShotAiOperations: 10,
    });
    expect(AI_QUOTA_EXCHANGE).toEqual({
      coachRepliesSpent: 20,
      postWorkoutAnalysesAdded: 10,
    });
  });

  it("allows exchange only while 20 unused replies remain", () => {
    expect(canExchangeAiQuota(base, 40, false)).toBe(true);
    expect(canExchangeAiQuota(base, 41, false)).toBe(false);
    expect(canExchangeAiQuota(base, 0, true)).toBe(false);
  });

  it("uses a stable UTC calendar-month bucket", () => {
    expect(aiQuotaBucketStart(new Date("2026-08-31T23:59:59.999Z"))).toEqual(
      new Date("2026-08-01T00:00:00.000Z"),
    );
    expect(() => aiQuotaBucketStart(new Date(Number.NaN))).toThrow(TypeError);
  });

  it("reports independent remaining allowances", () => {
    const overview = buildAiQuotaOverview(
      base,
      {
        postWorkoutAnalyses: 3,
        coachReplies: 12,
        progressSummaries: 4,
        oneShotAiOperations: 2,
      },
      false,
      new Date("2026-08-01T00:00:00.000Z"),
    );

    expect(overview.remaining).toEqual({
      postWorkoutAnalyses: 12,
      coachReplies: 48,
      progressSummaries: 16,
      oneShotAiOperations: 8,
    });
    expect(overview.exchange.available).toBe(true);
  });
});
