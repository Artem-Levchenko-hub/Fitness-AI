import { describe, expect, it } from "vitest";

import type { CardioSummary } from "@/lib/repos/cardio.repo";
import type { CircuitSummary } from "@/lib/repos/circuits.repo";
import type { RecentWorkout } from "@/lib/repos/workouts.repo";

import { isoWeekStartIso } from "@/lib/datetime/iso-week";

import { buildHistory, countWeekSessions } from "./history";

type Status = RecentWorkout["status"];

function strength(
  id: string,
  startedAt: Date,
  status: Status = "completed",
): RecentWorkout {
  return {
    id,
    name: `Силовая ${id}`,
    status,
    startedAt,
    finishedAt: null,
    setCount: 12,
    tonnageKg: 4200,
    hasAnalysis: true,
  };
}

function circuit(
  id: string,
  startedAt: Date,
  status: Status = "completed",
): CircuitSummary {
  return {
    id,
    name: `Круговая ${id}`,
    totalRounds: 3,
    restBetweenRoundsSec: 60,
    restBetweenExercisesSec: 15,
    status,
    startedAt,
    finishedAt: null,
    exerciseCount: 5,
    completedLogCount: 15,
    totalLogCount: 15,
    hasAnalysis: false,
  };
}

function cardio(
  id: string,
  startedAt: Date,
  status: Status = "completed",
): CardioSummary {
  return {
    id,
    name: `Кардио ${id}`,
    preset: "tabata",
    status,
    startedAt,
    finishedAt: null,
    totalPlannedSec: 240,
    totalActualSec: 238,
    workBlockCount: 8,
    completedWorkCount: 8,
    hrAvg: 152,
  };
}

const d = (iso: string) => new Date(iso);

describe("buildHistory", () => {
  it("returns empty for empty inputs", () => {
    expect(buildHistory([], [], [])).toEqual([]);
  });

  it("merges all three formats into one stream", () => {
    const items = buildHistory(
      [strength("s1", d("2026-06-01T10:00:00Z"))],
      [circuit("c1", d("2026-06-02T10:00:00Z"))],
      [cardio("k1", d("2026-06-03T10:00:00Z"))],
    );
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind).sort()).toEqual([
      "cardio",
      "circuit",
      "strength",
    ]);
  });

  it("excludes non-completed of EVERY format (active + cancelled)", () => {
    // Защита единого потока (G1/G2): брошенные/отменённые сессии любого
    // формата не должны попадать в историю.
    const items = buildHistory(
      [
        strength("s-done", d("2026-06-01T00:00:00Z"), "completed"),
        strength("s-active", d("2026-06-05T00:00:00Z"), "active"),
        strength("s-cancel", d("2026-06-06T00:00:00Z"), "cancelled"),
      ],
      [
        circuit("c-done", d("2026-06-02T00:00:00Z"), "completed"),
        circuit("c-active", d("2026-06-07T00:00:00Z"), "active"),
      ],
      [
        cardio("k-done", d("2026-06-03T00:00:00Z"), "completed"),
        cardio("k-cancel", d("2026-06-08T00:00:00Z"), "cancelled"),
      ],
    );
    expect(items.map((i) => i.id).sort()).toEqual(["c-done", "k-done", "s-done"]);
  });

  it("sorts newest-first across interleaved formats", () => {
    const items = buildHistory(
      [
        strength("s-old", d("2026-06-01T10:00:00Z")),
        strength("s-new", d("2026-06-10T10:00:00Z")),
      ],
      [circuit("c-mid", d("2026-06-05T10:00:00Z"))],
      [cardio("k-newest", d("2026-06-11T10:00:00Z"))],
    );
    expect(items.map((i) => i.id)).toEqual([
      "k-newest",
      "s-new",
      "c-mid",
      "s-old",
    ]);
  });

  it("maps strength fields (setCount, tonnageKg, hasAnalysis)", () => {
    const [item] = buildHistory([strength("s1", d("2026-06-01T10:00:00Z"))], [], []);
    expect(item).toMatchObject({
      kind: "strength",
      id: "s1",
      name: "Силовая s1",
      setCount: 12,
      tonnageKg: 4200,
      hasAnalysis: true,
    });
  });

  it("maps circuit fields (totalRounds, exerciseCount)", () => {
    const [item] = buildHistory([], [circuit("c1", d("2026-06-01T10:00:00Z"))], []);
    expect(item).toMatchObject({
      kind: "circuit",
      id: "c1",
      totalRounds: 3,
      exerciseCount: 5,
      hasAnalysis: false,
    });
  });

  it("maps cardio fields incl. nullable hrAvg and preset", () => {
    const withHr = cardio("k1", d("2026-06-01T10:00:00Z"));
    const noHr: CardioSummary = { ...cardio("k2", d("2026-06-02T10:00:00Z")), hrAvg: null };
    const items = buildHistory([], [], [withHr, noHr]);
    expect(items.find((i) => i.id === "k1")).toMatchObject({
      kind: "cardio",
      preset: "tabata",
      totalActualSec: 238,
      totalPlannedSec: 240,
      hrAvg: 152,
    });
    expect(items.find((i) => i.id === "k2")).toMatchObject({ hrAvg: null });
  });
});

describe("countWeekSessions", () => {
  const TZ = "Europe/Moscow";
  // Неделя, содержащая среду 2026-06-10 → понедельник 2026-06-08.
  const weekStart = isoWeekStartIso(d("2026-06-10T12:00:00Z"), TZ);

  it("returns 0 for empty history", () => {
    expect(countWeekSessions([], weekStart, TZ)).toBe(0);
  });

  it("counts ALL three formats in the current week (not just strength)", () => {
    const history = buildHistory(
      [strength("s1", d("2026-06-09T10:00:00Z"))],
      [circuit("c1", d("2026-06-10T10:00:00Z"))],
      [cardio("k1", d("2026-06-11T10:00:00Z"))],
    );
    expect(countWeekSessions(history, weekStart, TZ)).toBe(3);
  });

  it("excludes sessions from other weeks", () => {
    const history = buildHistory(
      [
        strength("s-this", d("2026-06-09T10:00:00Z")),
        strength("s-prev", d("2026-06-02T10:00:00Z")), // прошлая неделя
        strength("s-next", d("2026-06-16T10:00:00Z")), // следующая неделя
      ],
      [],
      [],
    );
    expect(countWeekSessions(history, weekStart, TZ)).toBe(1);
  });

  it("buckets by USER tz at the sunday↔monday boundary", () => {
    // 2026-06-08 00:30 MSK (UTC+3) = 2026-06-07 21:30 UTC. В MSK это уже
    // понедельник (эта неделя); в UTC — ещё воскресенье (прошлая). Граница
    // считается в TZ юзера → попадает в текущую неделю.
    const history = buildHistory(
      [strength("s-edge", d("2026-06-07T21:30:00Z"))],
      [],
      [],
    );
    expect(countWeekSessions(history, weekStart, TZ)).toBe(1);
  });
});
