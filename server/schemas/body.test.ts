import { describe, expect, it } from "vitest";

import { profileSchema } from "./body";

describe("profile display name", () => {
  it("trims a saved name", () => {
    expect(profileSchema.parse({ name: "  Анна Петрова  " }).name).toBe("Анна Петрова");
  });

  it("allows clearing a name while keeping legacy forms from changing it", () => {
    expect(profileSchema.parse({ name: "   " }).name).toBeNull();
    expect(profileSchema.parse({ name: null }).name).toBeNull();
    expect(profileSchema.parse({}).name).toBeUndefined();
  });

  it("rejects oversized names and uploaded files", () => {
    expect(profileSchema.safeParse({ name: "а".repeat(81) }).success).toBe(false);
    expect(profileSchema.safeParse({ name: new File(["name"], "name.txt") }).success).toBe(false);
  });
});
