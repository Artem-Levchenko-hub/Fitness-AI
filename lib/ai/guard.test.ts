import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  updateReturning: [] as unknown[],
  insertReturning: [] as unknown[],
  inArray: vi.fn(() => "in-array"),
  updateSet: vi.fn(),
  insertValues: vi.fn(),
}));

function queryChain(result: unknown[]) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    for: () => chain,
    limit: () => promise,
    then: promise.then.bind(promise),
  };
  return chain;
}

const tx = {
  select: vi.fn(() => queryChain(mocks.selectResults.shift() ?? [])),
  update: vi.fn(() => {
    const chain = {
      set: (value: unknown) => {
        mocks.updateSet(value);
        return chain;
      },
      where: () => chain,
      returning: async () => mocks.updateReturning,
    };
    return chain;
  }),
  insert: vi.fn(() => {
    const chain = {
      values: (value: unknown) => {
        mocks.insertValues(value);
        return chain;
      },
      returning: async () => mocks.insertReturning,
    };
    return chain;
  }),
};

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  count: vi.fn(() => "count"),
  countDistinct: vi.fn(() => "count-distinct"),
  eq: vi.fn(() => "eq"),
  gte: vi.fn(() => "gte"),
  inArray: mocks.inArray,
}));
vi.mock("@/db/client", () => ({
  db: {
    transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
  },
}));
vi.mock("@/db/schema", () => ({
  users: { id: "users.id" },
  aiUsageLedger: {
    id: "ledger.id",
    userId: "ledger.userId",
    operation: "ledger.operation",
    requestKey: "ledger.requestKey",
    scopeKey: "ledger.scopeKey",
    status: "ledger.status",
    bucketStart: "ledger.bucketStart",
    countsTowardQuota: "ledger.countsTowardQuota",
    createdAt: "ledger.createdAt",
    updatedAt: "ledger.updatedAt",
  },
  aiQuotaExchanges: {
    id: "exchange.id",
    userId: "exchange.userId",
    bucketStart: "exchange.bucketStart",
  },
  subscriptions: {
    userId: "subscriptions.userId",
    planCode: "subscriptions.planCode",
    tier: "subscriptions.tier",
    status: "subscriptions.status",
    currentPeriodStart: "subscriptions.currentPeriodStart",
    currentPeriodEnd: "subscriptions.currentPeriodEnd",
  },
}));
vi.mock("@/lib/billing/plans", () => ({
  hasActiveProAccess: (
    subscription: {
      tier: string;
      status: string;
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
    },
    now: Date,
  ) =>
    subscription.tier === "pro" &&
    ["active", "trialing"].includes(subscription.status) &&
    (!subscription.currentPeriodStart || subscription.currentPeriodStart <= now) &&
    Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > now),
  getBillingPlan: () => ({
    quotas: {
      postWorkoutAnalyses: 15,
      coachReplies: 60,
      progressSummaries: 20,
      oneShotAiOperations: 10,
    },
  }),
}));

const { claimAiCapacity } = await import("./guard");

describe("claimAiCapacity", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.length = 0;
    mocks.updateReturning = [];
    mocks.insertReturning = [];
  });

  it.each(["processing", "succeeded"] as const)(
    "never reopens a %s duplicate",
    async (status) => {
      mocks.selectResults.push(
        [{ id: "user-1" }],
        [
          {
            id: "usage-1",
            userId: "user-1",
            operation: "weekly_review",
            scopeKey: null,
            status,
            updatedAt: new Date("2026-08-02T11:00:00.000Z"),
          },
        ],
      );

      const result = await claimAiCapacity({
        userId: "user-1",
        operation: "weekly_review",
        requestKey: "weekly:user-1:2026-08-02",
        now,
      });

      expect(result).toEqual({ kind: "duplicate", usageId: "usage-1", status });
      expect(tx.update).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
    },
  );

  it("rate-limits an immediate retry of a failed reservation", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [
        {
          id: "usage-1",
          userId: "user-1",
          operation: "weekly_review",
          scopeKey: null,
          status: "failed",
          updatedAt: new Date("2026-08-02T11:59:30.000Z"),
        },
      ],
    );

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "weekly_review",
      requestKey: "weekly:user-1:2026-08-02",
      now,
    });

    expect(result).toEqual({ kind: "rate_limited", retryAfterSeconds: 60 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rechecks the workout-analysis quota before reopening a failed reservation", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [
        {
          id: "usage-1",
          userId: "user-1",
          operation: "weekly_review",
          scopeKey: null,
          status: "failed",
          updatedAt: new Date("2026-08-02T11:00:00.000Z"),
        },
      ],
      [{ total: 0 }],
      [
        {
          planCode: "pro_monthly",
          tier: "pro",
          status: "active",
          currentPeriodEnd: new Date("2026-09-02T00:00:00.000Z"),
        },
      ],
      [],
      [{ total: 0 }],
    );
    mocks.updateReturning = [{ id: "usage-1" }];

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "weekly_review",
      requestKey: "weekly:user-1:2026-08-02",
      now,
    });

    expect(result).toEqual({
      kind: "allowed",
      usageId: "usage-1",
      countsTowardQuota: true,
    });
    expect(mocks.inArray).toHaveBeenCalledWith("ledger.operation", [
      "weekly_review",
      "daily_digest",
    ]);
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        createdAt: now,
        updatedAt: now,
      }),
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("does not let summaries consume the protected workout-analysis quota", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [],
      [{ total: 0 }],
      [
        {
          planCode: "pro_monthly",
          tier: "pro",
          status: "active",
          currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      [],
      [{ total: 15 }],
    );

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "post_workout_analysis",
      requestKey: "analysis-16",
      now,
    });

    expect(result).toMatchObject({
      kind: "quota_exceeded",
      message: expect.stringContaining("разборов тренировок"),
    });
    expect(mocks.inArray).toHaveBeenCalledWith("ledger.operation", [
      "post_workout_analysis",
    ]);
  });

  it("counts 60 coach replies globally across workout conversations", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [],
      [{ total: 0 }],
      [
        {
          planCode: "pro_monthly",
          tier: "pro",
          status: "active",
          currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      [],
      [{ total: 59 }],
    );
    mocks.insertReturning = [{ id: "usage-60" }];

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "coach_reply",
      requestKey: "coach-60",
      scopeKey: "another-workout",
      now,
    });

    expect(result).toEqual({
      kind: "allowed",
      usageId: "usage-60",
      countsTowardQuota: true,
    });
    expect(tx.select).toHaveBeenCalledTimes(6);
    expect(mocks.inArray).toHaveBeenCalledWith("ledger.operation", [
      "coach_reply",
    ]);
  });

  it("marks wallet-funded coach replies outside the Pro quota", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [],
      [{ total: 0 }],
      [],
    );
    mocks.insertReturning = [{ id: "wallet-usage" }];

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "coach_reply",
      requestKey: "coach:wallet-operation",
      scopeKey: "workout-1",
      allowWallet: true,
      now,
    });

    expect(result).toEqual({
      kind: "allowed",
      usageId: "wallet-usage",
      countsTowardQuota: false,
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ countsTowardQuota: false }),
    );
  });

  it("applies the exchanged limits of 25 analyses and 40 replies", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [],
      [{ total: 0 }],
      [
        {
          planCode: "pro_monthly",
          tier: "pro",
          status: "active",
          currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      [{ id: "exchange-1" }],
      [{ total: 40 }],
    );

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "coach_reply",
      requestKey: "coach-41",
      scopeKey: "workout-1",
      now,
    });

    expect(result).toMatchObject({
      kind: "quota_exceeded",
      message: expect.stringContaining("вопросов"),
    });
  });

  it.each([
    {
      operation: "coach_reply" as const,
      used: 60,
      exchange: [] as unknown[],
      message: "вопросов",
    },
    {
      operation: "post_workout_analysis" as const,
      used: 25,
      exchange: [{ id: "exchange-1" }] as unknown[],
      message: "разборов тренировок",
    },
  ])("blocks $operation after its exact monthly limit", async (testCase) => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [],
      [{ total: 0 }],
      [
        {
          planCode: "pro_monthly",
          tier: "pro",
          status: "active",
          currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
      testCase.exchange,
      [{ total: testCase.used }],
    );

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: testCase.operation,
      requestKey: `blocked:${testCase.operation}`,
      scopeKey:
        testCase.operation === "coach_reply" ? "workout-1" : undefined,
      now,
    });

    expect(result).toMatchObject({
      kind: "quota_exceeded",
      message: expect.stringContaining(testCase.message),
    });
  });
});
