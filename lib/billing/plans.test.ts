import { describe, expect, it } from "vitest";

import {
  BILLING_PLANS,
  advanceUtcCalendarPeriod,
  effectiveAccessTier,
  getBillingPlan,
  hasActiveProAccess,
  isAccessActive,
  isBillingPlanCode,
} from "./plans";

describe("billing plans", () => {
  it("publishes the exact monthly and yearly prices in integer kopecks", () => {
    expect(BILLING_PLANS.pro_monthly).toMatchObject({
      code: "pro_monthly",
      priceKopecks: 29_000,
      currency: "RUB",
      interval: { unit: "month", count: 1 },
    });
    expect(BILLING_PLANS.pro_yearly).toMatchObject({
      code: "pro_yearly",
      priceKopecks: 290_000,
      currency: "RUB",
      interval: { unit: "year", count: 1 },
    });
  });

  it("keeps benefits and monthly-reset quotas explicit for both Pro periods", () => {
    const monthlyBenefits = BILLING_PLANS.pro_monthly.benefits;
    const yearlyBenefits = BILLING_PLANS.pro_yearly.benefits;

    expect(monthlyBenefits.length).toBeGreaterThan(0);
    expect(yearlyBenefits).toEqual(monthlyBenefits);
    expect(monthlyBenefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.any(String),
          label: expect.any(String),
        }),
      ]),
    );
    expect(new Set(monthlyBenefits.map(({ code }) => code)).size).toBe(
      monthlyBenefits.length,
    );
    expect(BILLING_PLANS.pro_monthly.quotas).toEqual({
      resetInterval: { unit: "month", count: 1 },
      postWorkoutAnalyses: 20,
      coachDialogs: 6,
      trainerRepliesPerDialog: 3,
      oneShotAiOperations: 10,
    });
    expect(BILLING_PLANS.pro_yearly.quotas).toEqual(
      BILLING_PLANS.pro_monthly.quotas,
    );
  });

  it("looks up only known plan codes", () => {
    expect(isBillingPlanCode("pro_monthly")).toBe(true);
    expect(isBillingPlanCode("pro_yearly")).toBe(true);
    expect(isBillingPlanCode("free")).toBe(false);
    expect(isBillingPlanCode(null)).toBe(false);
    expect(getBillingPlan("pro_monthly")).toBe(BILLING_PLANS.pro_monthly);
    expect(() => getBillingPlan("unknown")).toThrow(/unknown billing plan/i);
  });
});

describe("advanceUtcCalendarPeriod", () => {
  it("advances ordinary dates without changing their UTC time", () => {
    const start = new Date("2026-04-15T18:37:42.123Z");

    expect(
      advanceUtcCalendarPeriod(start, { unit: "month", count: 1 }).toISOString(),
    ).toBe("2026-05-15T18:37:42.123Z");
    expect(
      advanceUtcCalendarPeriod(start, { unit: "year", count: 1 }).toISOString(),
    ).toBe("2027-04-15T18:37:42.123Z");
  });

  it("clamps to and preserves the last day of a month", () => {
    const januaryEnd = new Date("2024-01-31T10:15:00.000Z");
    const februaryEnd = advanceUtcCalendarPeriod(januaryEnd, {
      unit: "month",
      count: 1,
    });

    expect(februaryEnd.toISOString()).toBe("2024-02-29T10:15:00.000Z");
    expect(
      advanceUtcCalendarPeriod(februaryEnd, {
        unit: "month",
        count: 1,
      }).toISOString(),
    ).toBe("2024-03-31T10:15:00.000Z");
  });

  it("handles leap-day yearly renewal in UTC", () => {
    expect(
      advanceUtcCalendarPeriod(new Date("2024-02-29T23:59:59.999Z"), {
        unit: "year",
        count: 1,
      }).toISOString(),
    ).toBe("2025-02-28T23:59:59.999Z");
  });

  it("does not mutate the input and rejects invalid intervals or dates", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    const timestamp = start.getTime();

    advanceUtcCalendarPeriod(start, { unit: "month", count: 2 });
    expect(start.getTime()).toBe(timestamp);
    expect(() =>
      advanceUtcCalendarPeriod(start, { unit: "month", count: 0 }),
    ).toThrow(/positive integer/i);
    expect(() =>
      advanceUtcCalendarPeriod(new Date(Number.NaN), {
        unit: "month",
        count: 1,
      }),
    ).toThrow(/valid date/i);
  });
});

describe("active billing access", () => {
  const now = new Date("2026-07-30T12:00:00.000Z");

  it("treats the period end as an exclusive boundary", () => {
    expect(
      isAccessActive(
        {
          status: "active",
          currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-07-30T12:00:00.001Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isAccessActive(
        {
          status: "active",
          currentPeriodEnd: new Date("2026-07-30T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects inactive statuses, not-yet-started periods and invalid dates", () => {
    expect(
      isAccessActive(
        {
          status: "past_due",
          currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAccessActive(
        {
          status: "active",
          currentPeriodStart: new Date("2026-07-30T12:00:00.001Z"),
          currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAccessActive(
        { status: "active", currentPeriodEnd: new Date(Number.NaN) },
        now,
      ),
    ).toBe(false);
  });

  it("allows active trials but rejects other inactive subscription states", () => {
    expect(
      isAccessActive(
        {
          status: "trialing",
          currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);

    for (const status of [
      "past_due",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "paused",
      null,
    ] as const) {
      expect(
        isAccessActive(
          {
            status,
            currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
          },
          now,
        ),
      ).toBe(false);
    }
  });

  it("grants Pro only for a Pro tier with active access", () => {
    const activePeriod = {
      status: "active" as const,
      currentPeriodEnd: new Date("2026-08-30T12:00:00.000Z"),
    };

    expect(hasActiveProAccess({ tier: "pro", ...activePeriod }, now)).toBe(true);
    expect(hasActiveProAccess({ tier: "free", ...activePeriod }, now)).toBe(
      false,
    );
    expect(
      hasActiveProAccess(
        {
          tier: "pro",
          status: "canceled",
          currentPeriodEnd: activePeriod.currentPeriodEnd,
        },
        now,
      ),
    ).toBe(false);
    expect(effectiveAccessTier({ tier: "pro", ...activePeriod }, now)).toBe(
      "pro",
    );
    expect(
      effectiveAccessTier(
        {
          tier: "pro",
          status: "canceled",
          currentPeriodEnd: activePeriod.currentPeriodEnd,
        },
        now,
      ),
    ).toBe("free");
  });
});
