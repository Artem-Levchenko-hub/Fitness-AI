import { describe, expect, it } from "vitest";

import {
  buildAchievementTracks,
  calendarMonthBounds,
  countAchievementLevels,
  countUnlockedAchievements,
} from "./achievements";

describe("calendarMonthBounds", () => {
  it("uses the user's local calendar month across UTC midnight", () => {
    expect(
      calendarMonthBounds(
        new Date("2026-07-31T22:30:00Z"),
        "Europe/Moscow",
      ),
    ).toMatchObject({ start: "2026-08-01", end: "2026-09-01" });
  });

  it("rolls December into January", () => {
    expect(
      calendarMonthBounds(new Date("2026-12-15T12:00:00Z"), "UTC"),
    ).toMatchObject({ start: "2026-12-01", end: "2027-01-01" });
  });
});

describe("buildAchievementTracks", () => {
  it("unlocks a level at the exact threshold and exposes the next one", () => {
    const tracks = buildAchievementTracks({
      workouts: 10,
      pullUpReps: 500,
      benchPressKg: 100,
      backSquatKg: 79.5,
    });

    expect(tracks.find((track) => track.key === "pullUpReps")).toMatchObject({
      unlocked: 2,
      nextTarget: 1_000,
      progressPct: 50,
    });
    expect(tracks.find((track) => track.key === "benchPressKg")).toMatchObject({
      unlocked: 3,
      nextTarget: 120,
    });
    expect(countUnlockedAchievements(tracks)).toBe(6);
    expect(countAchievementLevels(tracks)).toBe(15);
  });

  it("marks a completed track as 100 percent", () => {
    const pullUps = buildAchievementTracks({
      workouts: 0,
      pullUpReps: 1_200,
      benchPressKg: 0,
      backSquatKg: 0,
    })[0]!;

    expect(pullUps).toMatchObject({
      unlocked: 3,
      nextTarget: null,
      progressPct: 100,
    });
  });
});
