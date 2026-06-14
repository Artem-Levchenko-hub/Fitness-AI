import { describe, expect, it } from "vitest";

import { combineActivityTotals, type ActivityTotals } from "./activity-totals";

describe("combineActivityTotals", () => {
  it("returns zeros for no parts / all empty", () => {
    expect(combineActivityTotals([])).toEqual({
      sets: 0,
      reps: 0,
      tonnageKg: 0,
    });
  });

  it("passes a single strength part through", () => {
    const strength: ActivityTotals = { sets: 12, reps: 96, tonnageKg: 4200 };
    expect(combineActivityTotals([strength])).toEqual(strength);
  });

  it("counts a circuit-only user — KPI is no longer contradictory", () => {
    // Bodyweight круговая: подходы и повторы есть, тоннаж 0 (нет веса). Раньше
    // KPI показывал «5 тренировок / 0 подходов / 0 повторений» — теперь честно.
    const circuit: ActivityTotals = { sets: 18, reps: 240, tonnageKg: 0 };
    expect(combineActivityTotals([circuit])).toEqual({
      sets: 18,
      reps: 240,
      tonnageKg: 0,
    });
  });

  it("sums strength + circuit contributions into combined totals", () => {
    const strength: ActivityTotals = { sets: 12, reps: 96, tonnageKg: 4200 };
    const circuit: ActivityTotals = { sets: 18, reps: 240, tonnageKg: 360 };
    expect(combineActivityTotals([strength, circuit])).toEqual({
      sets: 30,
      reps: 336,
      tonnageKg: 4560,
    });
  });

  it("is order-independent and ignores zero parts", () => {
    const a: ActivityTotals = { sets: 3, reps: 30, tonnageKg: 100 };
    const zero: ActivityTotals = { sets: 0, reps: 0, tonnageKg: 0 };
    expect(combineActivityTotals([zero, a, zero])).toEqual(a);
  });
});
