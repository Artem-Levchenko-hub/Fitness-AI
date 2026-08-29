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
      maxWorkoutTonnageT: 10,
      totalTonnageT: 204,
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
    const workoutTonnage = tracks.find(
      (track) => track.key === "maxWorkoutTonnageT",
    )!;
    expect(workoutTonnage.levels).toEqual([1, 10]);
    expect(workoutTonnage).toMatchObject({
      unlocked: 2,
      nextTarget: null,
      progressPct: 100,
    });
    expect(workoutTonnage.levelLabels?.[10]).toBe("🐘 Африканский слон");
    const lifetimeTonnage = tracks.find(
      (track) => track.key === "totalTonnageT",
    )!;
    expect(lifetimeTonnage.levels).toEqual([
      100, 204, 250, 1_000, 3_000, 5_000, 10_000, 20_000,
    ]);
    expect(lifetimeTonnage).toMatchObject({
      unlocked: 2,
      nextTarget: 250,
      progressPct: 81,
    });
    expect(lifetimeTonnage.levelLabels?.[204]).toBe("🗽 Статуя Свободы");
    expect(countUnlockedAchievements(tracks)).toBe(10);
    expect(countAchievementLevels(tracks)).toBe(25);
  });

  it("marks a completed track as 100 percent", () => {
    const pullUps = buildAchievementTracks({
      workouts: 0,
      pullUpReps: 1_200,
      benchPressKg: 0,
      backSquatKg: 0,
      maxWorkoutTonnageT: 0,
      totalTonnageT: 0,
    }).find((track) => track.key === "pullUpReps")!;

    expect(pullUps).toMatchObject({
      unlocked: 3,
      nextTarget: null,
      progressPct: 100,
    });
  });
});
