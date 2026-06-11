import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rangeToFromDate, type StatsRange } from "./range";

/** Характеризационное покрытие политики временного окна `/stats`.
 *  `rangeToFromDate` задаёт дату-отсечку, которую КАЖДЫЙ stats-запрос
 *  (dailyVolume/weeklyVolume/oneRmTrend/topLineKpi/… в stats.repo) подставляет в
 *  `gte(startedAt, from)` → она решает, какие тренировки попадут в графики
 *  владельца (тема G1 «графики ровно по моим тренировкам»). Регресс в границе =
 *  кривое окно = неверные графики. `Date.now()` мокается для детерминизма. */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-11T12:00:00.000Z");
const FINITE_RANGES: StatsRange[] = ["7d", "30d", "90d", "365d"];

describe("rangeToFromDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("'all' → null (без фильтра по времени — все завершённые)", () => {
    expect(rangeToFromDate("all")).toBeNull();
  });

  it("'7d' → отсечка ровно 7 суток назад от текущего момента", () => {
    const from = rangeToFromDate("7d");
    expect(from).not.toBeNull();
    expect(NOW.getTime() - from!.getTime()).toBe(7 * DAY_MS);
  });

  it("'30d' → ровно 30 суток назад", () => {
    expect(NOW.getTime() - rangeToFromDate("30d")!.getTime()).toBe(30 * DAY_MS);
  });

  it("'90d' → ровно 90 суток назад", () => {
    expect(NOW.getTime() - rangeToFromDate("90d")!.getTime()).toBe(90 * DAY_MS);
  });

  it("'365d' → ровно 365 суток назад", () => {
    expect(NOW.getTime() - rangeToFromDate("365d")!.getTime()).toBe(
      365 * DAY_MS,
    );
  });

  it("конечные диапазоны → Date в прошлом", () => {
    for (const r of FINITE_RANGES) {
      const from = rangeToFromDate(r);
      expect(from).toBeInstanceOf(Date);
      expect(from!.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it("скользящее окно: отсечка сдвигается вместе с текущим моментом", () => {
    const before = rangeToFromDate("7d")!;
    vi.setSystemTime(new Date(NOW.getTime() + 3 * DAY_MS));
    const after = rangeToFromDate("7d")!;
    expect(after.getTime() - before.getTime()).toBe(3 * DAY_MS);
  });

  it("больший диапазон → более ранняя отсечка (монотонность)", () => {
    const d7 = rangeToFromDate("7d")!.getTime();
    const d30 = rangeToFromDate("30d")!.getTime();
    const d365 = rangeToFromDate("365d")!.getTime();
    expect(d30).toBeLessThan(d7);
    expect(d365).toBeLessThan(d30);
  });
});
