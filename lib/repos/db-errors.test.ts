import { describe, expect, it } from "vitest";

import { getDatabaseConstraintName } from "./db-errors";

describe("getDatabaseConstraintName", () => {
  it("reads a postgres constraint from the direct driver error", () => {
    expect(
      getDatabaseConstraintName({ constraint_name: "payments_unique" }),
    ).toBe("payments_unique");
  });

  it("unwraps the original driver error from an ORM cause", () => {
    expect(
      getDatabaseConstraintName({
        name: "DrizzleQueryError",
        cause: {
          constraint_name: "payments_initial_subscription_inflight_unq",
        },
      }),
    ).toBe("payments_initial_subscription_inflight_unq");
  });

  it("does not classify unrelated errors", () => {
    expect(getDatabaseConstraintName(new Error("network failed"))).toBeNull();
  });

  it("stops safely on a cyclic cause chain", () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;

    expect(getDatabaseConstraintName(cyclic)).toBeNull();
  });
});
