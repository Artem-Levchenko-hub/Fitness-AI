import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  insertReturning: [] as unknown[],
  insertValues: vi.fn(),
  locks: 0,
}));

function queryChain(result: unknown[]) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> & PromiseLike<unknown[]> = {
    from: () => chain,
    where: () => chain,
    for: () => {
      mocks.locks += 1;
      return chain;
    },
    limit: () => promise,
    groupBy: () => promise,
    then: promise.then.bind(promise),
  };
  return chain;
}

const tx = {
  select: vi.fn(() => queryChain(mocks.selectResults.shift() ?? [])),
  insert: vi.fn(() => {
    const chain = {
      values: (value: unknown) => {
        mocks.insertValues(value);
        return chain;
      },
      onConflictDoNothing: () => chain,
      returning: async () => mocks.insertReturning,
    };
    return chain;
  }),
};

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  count: vi.fn(() => "count"),
  eq: vi.fn(() => "eq"),
  inArray: vi.fn(() => "in-array"),
}));
vi.mock("@/db/client", () => ({
  db: {
    transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
  },
}));
vi.mock("@/db/schema", () => ({
  users: { id: "users.id" },
  subscriptions: {
    userId: "subscriptions.userId",
  },
  aiQuotaExchanges: {
    id: "exchange.id",
    userId: "exchange.userId",
    bucketStart: "exchange.bucketStart",
  },
  aiUsageLedger: {
    userId: "ledger.userId",
    operation: "ledger.operation",
    status: "ledger.status",
    bucketStart: "ledger.bucketStart",
    countsTowardQuota: "ledger.countsTowardQuota",
  },
}));

const { exchangeAiQuota } = await import("./ai-quota.repo");

describe("exchangeAiQuota", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");
  const subscription = {
    planCode: "pro_monthly",
    tier: "pro" as const,
    status: "active" as const,
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.length = 0;
    mocks.insertReturning = [];
    mocks.locks = 0;
  });

  it("atomically exchanges at the 40-used boundary", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [subscription],
      [],
      [{ operation: "coach_reply", total: 40 }],
    );
    mocks.insertReturning = [{ id: "exchange-1" }];

    const result = await exchangeAiQuota("user-1", now);

    expect(result.kind).toBe("exchanged");
    expect(result).toMatchObject({
      overview: {
        limits: { postWorkoutAnalyses: 25, coachReplies: 40 },
        remaining: { postWorkoutAnalyses: 25, coachReplies: 0 },
        exchange: { completed: true, available: false },
      },
    });
    expect(mocks.locks).toBe(2);
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        bucketStart: new Date("2026-08-01T00:00:00.000Z"),
        coachRepliesSpent: 20,
        postWorkoutAnalysesAdded: 10,
      }),
    );
  });

  it("rejects exchange when fewer than 20 replies remain", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [subscription],
      [],
      [{ operation: "coach_reply", total: 41 }],
    );

    const result = await exchangeAiQuota("user-1", now);

    expect(result.kind).toBe("insufficient_questions");
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("returns the same effective quotas after an idempotent replay", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [subscription],
      [{ id: "exchange-1" }],
      [{ operation: "post_workout_analysis", total: 7 }],
    );

    const result = await exchangeAiQuota("user-1", now);

    expect(result.kind).toBe("already_exchanged");
    expect(result).toMatchObject({
      overview: {
        limits: { postWorkoutAnalyses: 25, coachReplies: 40 },
        remaining: { postWorkoutAnalyses: 18, coachReplies: 40 },
      },
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("requires active Pro access", async () => {
    mocks.selectResults.push(
      [{ id: "user-1" }],
      [{ ...subscription, status: "past_due" }],
    );

    await expect(exchangeAiQuota("user-1", now)).resolves.toEqual({
      kind: "subscription_required",
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
