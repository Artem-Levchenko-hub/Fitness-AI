import { describe, expect, it } from "vitest";

import type { CardioSummary } from "@/lib/repos/cardio.repo";
import type { CircuitSummary } from "@/lib/repos/circuits.repo";
import type { HistoryItem } from "@/lib/domain/workouts/history";
import type { RecentWorkout } from "@/lib/repos/workouts.repo";

import {
  friendDisplayName,
  friendEventFormat,
  friendEventMeta,
  selectLastEvent,
  selectTopFriendActivity,
  sortFriendsByRecency,
} from "./friend-activity";

const d = (iso: string) => new Date(iso);

function strength(id: string, startedAt: Date): RecentWorkout {
  return {
    id,
    name: `Силовая ${id}`,
    status: "completed",
    startedAt,
    finishedAt: null,
    setCount: 12,
    tonnageKg: 4250.6,
    hasAnalysis: true,
  };
}

function circuit(id: string, startedAt: Date): CircuitSummary {
  return {
    id,
    name: `Круговая ${id}`,
    totalRounds: 4,
    restBetweenRoundsSec: 60,
    restBetweenExercisesSec: 15,
    status: "completed",
    startedAt,
    finishedAt: null,
    exerciseCount: 5,
    completedLogCount: 20,
    totalLogCount: 20,
    hasAnalysis: false,
  };
}

function cardio(id: string, startedAt: Date): CardioSummary {
  return {
    id,
    name: `Кардио ${id}`,
    preset: "tabata",
    status: "completed",
    startedAt,
    finishedAt: null,
    totalPlannedSec: 600,
    totalActualSec: 540,
    workBlockCount: 8,
    completedWorkCount: 8,
    hrAvg: 152,
  };
}

describe("selectLastEvent", () => {
  it("returns null when the friend has no completed sessions", () => {
    expect(selectLastEvent([], [], [])).toBeNull();
  });

  it("picks the newest event across ALL three formats", () => {
    const last = selectLastEvent(
      [strength("s", d("2026-06-01T10:00:00Z"))],
      [circuit("c", d("2026-06-03T10:00:00Z"))],
      [cardio("k", d("2026-06-02T10:00:00Z"))],
    );
    expect(last?.kind).toBe("circuit");
    expect(last?.id).toBe("c");
  });

  it("ignores non-completed (active/cancelled) sessions via buildHistory", () => {
    const active: RecentWorkout = {
      ...strength("s-active", d("2026-06-09T10:00:00Z")),
      status: "active",
    };
    const last = selectLastEvent(
      [active, strength("s-done", d("2026-06-01T10:00:00Z"))],
      [],
      [],
    );
    expect(last?.id).toBe("s-done");
  });
});

describe("friendEventFormat", () => {
  it("labels each format in Russian (text, not only colour — R-41)", () => {
    const s = selectLastEvent([strength("s", d("2026-06-01T10:00:00Z"))], [], [])!;
    const c = selectLastEvent([], [circuit("c", d("2026-06-01T10:00:00Z"))], [])!;
    const k = selectLastEvent([], [], [cardio("k", d("2026-06-01T10:00:00Z"))])!;
    expect(friendEventFormat(s)).toBe("Силовая");
    expect(friendEventFormat(c)).toBe("Круговая");
    expect(friendEventFormat(k)).toBe("Кардио");
  });
});

describe("friendEventMeta", () => {
  it("strength → tonnage matching the friend detail page (rounded, ru-RU)", () => {
    const s = selectLastEvent([strength("s", d("2026-06-01T10:00:00Z"))], [], [])!;
    // tonnageKg 4250.6 → Math.round 4251 → "4 251 kg·reps" (NBSP thousands).
    expect(friendEventMeta(s)).toBe(
      `${(4251).toLocaleString("ru-RU")} kg·reps`,
    );
  });

  it("circuit → rounds + exercise count (no tonnage exists for circuits)", () => {
    const c = selectLastEvent([], [circuit("c", d("2026-06-01T10:00:00Z"))], [])!;
    expect(friendEventMeta(c)).toBe("4 кругов · 5 упр.");
  });

  it("cardio → minutes from actual time (falls back to planned)", () => {
    const k = selectLastEvent([], [], [cardio("k", d("2026-06-01T10:00:00Z"))])!;
    // 540s → 9 мин.
    expect(friendEventMeta(k)).toBe("9 мин");
  });

  it("cardio with no time logged → planned, never empty", () => {
    const zero: CardioSummary = {
      ...cardio("k0", d("2026-06-01T10:00:00Z")),
      totalActualSec: 0,
      totalPlannedSec: 600,
    };
    const k = selectLastEvent([], [], [zero])!;
    expect(friendEventMeta(k)).toBe("10 мин");
  });
});

describe("sortFriendsByRecency", () => {
  const item = (startedAt: Date): HistoryItem => ({
    kind: "strength",
    id: "x",
    name: "x",
    startedAt,
    finishedAt: null,
    setCount: 1,
    tonnageKg: 1,
    hasAnalysis: false,
  });

  it("orders friends by last-event recency desc, no-event friends last", () => {
    const a = { user: "a", lastEvent: item(d("2026-06-01T10:00:00Z")) };
    const b = { user: "b", lastEvent: item(d("2026-06-05T10:00:00Z")) };
    const c = { user: "c", lastEvent: null };
    const sorted = sortFriendsByRecency([a, c, b]);
    expect(sorted.map((f) => f.user)).toEqual(["b", "a", "c"]);
  });

  it("is a pure copy — does not mutate the input array", () => {
    const a = { user: "a", lastEvent: item(d("2026-06-01T10:00:00Z")) };
    const b = { user: "b", lastEvent: null };
    const input = [b, a];
    const sorted = sortFriendsByRecency(input);
    expect(input).toEqual([b, a]);
    expect(sorted).not.toBe(input);
  });
});

describe("selectTopFriendActivity", () => {
  const item = (startedAt: Date): HistoryItem => ({
    kind: "strength",
    id: "x",
    name: "x",
    startedAt,
    finishedAt: null,
    setCount: 1,
    tonnageKg: 1,
    hasAnalysis: false,
  });

  it("returns null for an empty list (0 friends)", () => {
    expect(selectTopFriendActivity([])).toBeNull();
  });

  it("returns null when no friend has any event (0 events)", () => {
    const a = { user: "a", lastEvent: null };
    const b = { user: "b", lastEvent: null };
    expect(selectTopFriendActivity([a, b])).toBeNull();
  });

  it("picks the single most recent event among all friends, even unsorted", () => {
    const a = { user: "a", lastEvent: item(d("2026-06-01T10:00:00Z")) };
    const b = { user: "b", lastEvent: item(d("2026-06-05T10:00:00Z")) };
    const c = { user: "c", lastEvent: null };
    // Input order does NOT match recency — must still surface b (newest).
    expect(selectTopFriendActivity([a, c, b])?.user).toBe("b");
  });

  it("skips no-event friends and returns the most recent that has one", () => {
    const a = { user: "a", lastEvent: null };
    const b = { user: "b", lastEvent: item(d("2026-06-02T10:00:00Z")) };
    expect(selectTopFriendActivity([a, b])?.user).toBe("b");
  });
});

describe("friendDisplayName", () => {
  it("uses the name when present (trimmed)", () => {
    expect(friendDisplayName({ name: "  Alex  ", email: "a@x.io" })).toBe("Alex");
  });

  it("falls back to email when name is null or blank", () => {
    expect(friendDisplayName({ name: null, email: "a@x.io" })).toBe("a@x.io");
    expect(friendDisplayName({ name: "   ", email: "a@x.io" })).toBe("a@x.io");
  });
});
