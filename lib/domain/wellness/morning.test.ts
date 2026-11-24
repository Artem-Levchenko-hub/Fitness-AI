import { describe, expect, it } from "vitest";

import { morningContext, morningPromptAllowed, shouldShowMorningPrompt } from "./morning";

describe("morning wellness prompt", () => {
  it.each([
    ["2026-11-24T01:59:59Z", false],
    ["2026-11-24T02:00:00Z", true],
    ["2026-11-24T08:59:59Z", true],
    ["2026-11-24T09:00:00Z", false],
  ])("uses the profile timezone at the morning boundary %s", (instant, isMorning) => {
    expect(morningContext(new Date(instant), "Europe/Moscow")).toEqual({
      date: "2026-11-24", proteinDate: "2026-11-23", isMorning,
    });
  });

  it("uses local waking date and previous local intake day across UTC midnight", () => {
    expect(morningContext(new Date("2026-12-31T20:00:00Z"), "Asia/Tokyo")).toEqual({
      date: "2027-01-01", proteinDate: "2026-12-31", isMorning: true,
    });
  });

  it("falls back consistently to Moscow for an invalid profile timezone", () => {
    expect(morningContext(new Date("2026-11-24T02:30:00Z"), "Invalid/Zone").isMorning).toBe(true);
  });

  it.each(["/workouts/id", "/circuits/id", "/cardio/id", "/exercises/id", "/templates/new", "/create", "/sleep", "/nutrition"])("does not interrupt %s", (pathname) => {
    expect(morningPromptAllowed(pathname)).toBe(false);
  });

  it.each(["/dashboard", "/stats", "/workouts", "/profile", "/exercises"])("allows the first entry on %s", (pathname) => {
    expect(morningPromptAllowed(pathname)).toBe(true);
  });

  it("does not repeat after dismissing or partially submitting that morning, but allows the next morning", () => {
    const context = { date: "2026-11-24", proteinDate: "2026-11-23", isMorning: true };
    expect(shouldShowMorningPrompt(context, { sleep: true, protein: false }, "2026-11-24")).toBe(false);
    expect(shouldShowMorningPrompt(context, { sleep: true, protein: false }, "2026-11-23")).toBe(true);
    expect(shouldShowMorningPrompt(context, { sleep: true, protein: true }, null)).toBe(false);
    expect(shouldShowMorningPrompt({ ...context, isMorning: false }, { sleep: false, protein: false }, null)).toBe(false);
    expect(shouldShowMorningPrompt(context, { sleep: false, protein: true }, null)).toBe(true);
  });
});
