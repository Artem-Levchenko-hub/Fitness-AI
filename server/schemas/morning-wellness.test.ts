import { describe, expect, it } from "vitest";

import { morningWellnessSchema } from "./morning-wellness";

describe("morning wellness input", () => {
  it("accepts sleep or protein independently and preserves blank as absent", () => {
    expect(morningWellnessSchema.parse({ date: "2026-11-24", hours: "7,5", proteinG: "" })).toEqual({
      date: "2026-11-24", hours: 7.5, proteinG: undefined,
    });
    expect(morningWellnessSchema.parse({ date: "2026-11-24", hours: "", proteinG: "0" })).toEqual({
      date: "2026-11-24", hours: undefined, proteinG: 0,
    });
  });

  it.each([
    { hours: "", proteinG: " " },
    { hours: null },
    { hours: "-1" },
    { hours: "24.1" },
    { proteinG: "1001" },
    { proteinG: "NaN" },
    { hours: "7", date: "2026-02-30" },
  ])("rejects missing, impossible or out-of-range data %j", (input) => {
    expect(morningWellnessSchema.safeParse({ date: "2026-11-24", ...input }).success).toBe(false);
  });
});
