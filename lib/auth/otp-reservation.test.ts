import { describe, expect, it } from "vitest";

import { otpReservationKey } from "./otp-reservation";

describe("otpReservationKey", () => {
  it("не сталкивает одновременные выдачи одному email", () => {
    const first = otpReservationKey("user@example.test", "first-hash");
    const second = otpReservationKey("user@example.test", "second-hash");

    expect(first).not.toBe(second);
    expect(new Map([[first, "first"], [second, "second"]]).size).toBe(2);
  });

  it("разделяет разные identifier даже при одинаковом token hash", () => {
    expect(
      otpReservationKey("first@example.test", "same-hash"),
    ).not.toBe(otpReservationKey("second@example.test", "same-hash"));
  });
});
