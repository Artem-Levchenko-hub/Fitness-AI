import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { postgresTimestampParameter } from "./postgres-timestamp";

describe("postgresTimestampParameter", () => {
  it("returns a stable UTC string for a database parameter", () => {
    expect(
      postgresTimestampParameter(new Date("2026-08-11T19:44:01.588Z")),
    ).toBe("2026-08-11T19:44:01.588Z");
  });

  it("accepts a Date created in another JavaScript realm", () => {
    const crossRealmDate = runInNewContext(
      'new Date("2026-08-11T19:44:01.588Z")',
    ) as Date;

    expect(crossRealmDate).not.toBeInstanceOf(Date);
    expect(postgresTimestampParameter(crossRealmDate)).toBe(
      "2026-08-11T19:44:01.588Z",
    );
  });

  it("rejects an invalid date instead of sending corrupt SQL", () => {
    expect(() => postgresTimestampParameter(new Date(Number.NaN))).toThrow(
      RangeError,
    );
  });
});
