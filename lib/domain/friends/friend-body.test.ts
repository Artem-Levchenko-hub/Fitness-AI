import { describe, expect, it } from "vitest";

import { formatFriendBodyLine } from "./friend-body";

describe("formatFriendBodyLine", () => {
  it("оба отсутствуют → null (строка скрыта, R-37)", () => {
    expect(formatFriendBodyLine(null, null)).toBeNull();
    expect(formatFriendBodyLine(undefined, undefined)).toBeNull();
  });

  it("только рост → «N см»", () => {
    expect(formatFriendBodyLine(178, null)).toBe("178 см");
  });

  it("только вес → «M.M кг» (toFixed(1), как /body)", () => {
    expect(formatFriendBodyLine(null, 82.5)).toBe("82.5 кг");
  });

  it("оба → «N см · M.M кг» (рост ведёт, разделитель · )", () => {
    expect(formatFriendBodyLine(178, 82.5)).toBe("178 см · 82.5 кг");
  });

  it("целый вес печатается с одним знаком (паритет /body)", () => {
    expect(formatFriendBodyLine(180, 82)).toBe("180 см · 82.0 кг");
  });

  it("нулевые/отрицательные значения трактуются как отсутствие", () => {
    expect(formatFriendBodyLine(0, 0)).toBeNull();
    expect(formatFriendBodyLine(-5, 80)).toBe("80.0 кг");
  });

  it("NaN/Infinity отбрасываются (fail-soft)", () => {
    expect(formatFriendBodyLine(Number.NaN, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
