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
    createdAt: "ledger.createdAt",
    updatedAt: "ledger.updatedAt",
  },
  subscriptions: {
    userId: "subscriptions.userId",
    planCode: "subscriptions.planCode",
    tier: "subscriptions.tier",
    status: "subscriptions.status",
    currentPeriodEnd: "subscriptions.currentPeriodEnd",
  },
}));
vi.mock("@/lib/billing/plans", () => ({
  getBillingPlan: () => ({
    quotas: {
      postWorkoutAnalyses: 20,
      oneShotAiOperations: 10,
      trainerRepliesPerDialog: 20,
      coachDialogs: 5,
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

  it("rechecks the shared analysis quota before reopening a failed reservation", async () => {
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
      [{ total: 0 }],
    );
    mocks.updateReturning = [{ id: "usage-1" }];

    const result = await claimAiCapacity({
      userId: "user-1",
      operation: "weekly_review",
      requestKey: "weekly:user-1:2026-08-02",
      now,
    });

    expect(result).toEqual({ kind: "allowed", usageId: "usage-1" });
    expect(mocks.inArray).toHaveBeenCalledWith("ledger.operation", [
      "post_workout_analysis",
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
});
