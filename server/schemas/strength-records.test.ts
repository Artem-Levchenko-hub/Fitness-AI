import { describe, expect, it } from "vitest";

import { strengthRecordSchema } from "./strength-records";

describe("strengthRecordSchema", () => {
  it("accepts an integer pull-up result", () => {
    const parsed = strengthRecordSchema("2026-08-12").safeParse({
      movement: "pull_up",
      value: "14",
      performedAt: "2026-08-12",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.value).toBe(14);
  });

  it("rejects fractional pull-up repetitions", () => {
    const parsed = strengthRecordSchema("2026-08-12").safeParse({
      movement: "pull_up",
      value: "14.5",
      performedAt: "2026-08-12",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts half-kilogram steps for barbell tests", () => {
    const parsed = strengthRecordSchema("2026-08-12").safeParse({
      movement: "bench_press",
      value: "82.5",
      performedAt: "2026-08-12",
    });

    expect(parsed.success).toBe(true);
  });

  it.each(["0", "0.5", "1001"])("rejects an invalid barbell value: %s", (value) => {
    const parsed = strengthRecordSchema("2026-08-12").safeParse({
      movement: "back_squat",
      value,
      performedAt: "2026-08-12",
    });

    expect(parsed.success).toBe(false);
  });

  it.each(["2026-02-31", "2026-08-13"])(
    "rejects an invalid date: %s",
    (performedAt) => {
      const parsed = strengthRecordSchema("2026-08-12").safeParse({
        movement: "bench_press",
        value: "80",
        performedAt,
      });

      expect(parsed.success).toBe(false);
    },
  );

  it("rejects barbell weights outside a half-kilogram step", () => {
    const parsed = strengthRecordSchema("2026-08-12").safeParse({
      movement: "bench_press",
      value: "82.55",
      performedAt: "2026-08-12",
    });

    expect(parsed.success).toBe(false);
  });
});
