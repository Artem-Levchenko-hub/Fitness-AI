import { describe, expect, it } from "vitest";

import {
  RESUME_MAX_AGE_HOURS,
  isResumable,
  resumeCutoff,
} from "./active-session";

const NOW = new Date("2026-06-12T12:00:00.000Z");

describe("resumeCutoff", () => {
  it("returns now minus RESUME_MAX_AGE_HOURS", () => {
    const cutoff = resumeCutoff(NOW);
    expect(cutoff.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });

  it("uses a 12-hour window", () => {
    expect(RESUME_MAX_AGE_HOURS).toBe(12);
  });

  it("does not mutate the passed-in now", () => {
    const before = NOW.getTime();
    resumeCutoff(NOW);
    expect(NOW.getTime()).toBe(before);
  });
});

describe("isResumable", () => {
  it("treats a fresh session as resumable", () => {
    const startedAt = new Date("2026-06-12T11:00:00.000Z"); // 1h ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });

  it("treats a session at exactly the cutoff as resumable (inclusive)", () => {
    const startedAt = new Date("2026-06-12T00:00:00.000Z"); // exactly 12h ago
    expect(isResumable(startedAt, NOW)).toBe(true);
  });

  it("treats a session one minute past the cutoff as stale", () => {
    const startedAt = new Date("2026-06-11T23:59:00.000Z"); // 12h01m ago
    expect(isResumable(startedAt, NOW)).toBe(false);
  });

  it("treats a session aged to N+1 hours as stale (phantom)", () => {
    const startedAt = new Date("2026-06-11T23:00:00.000Z"); // 13h ago
    expect(isResumable(startedAt, NOW)).toBe(false);
  });
});
