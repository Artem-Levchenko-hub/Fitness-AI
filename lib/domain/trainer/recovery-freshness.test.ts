import { describe, expect, it } from "vitest";

import { isFreshRecoveryDay } from "./recovery-freshness";

describe("isFreshRecoveryDay", () => {
  it("uses the athlete's timezone at the UTC day boundary", () => {
    const now = new Date("2026-08-05T21:30:00.000Z"); // 00:30 6 Aug Moscow
    expect(isFreshRecoveryDay("2026-08-06", "Europe/Moscow", now)).toBe(true);
    expect(isFreshRecoveryDay("2026-08-04", "Europe/Moscow", now)).toBe(false);
  });
});
