import { describe, expect, it } from "vitest";

import {
  trimZeroEdges,
  weeklyVolumeSeries,
  type WeeklyVolumeContribution,
} from "./weekly-volume";

// H17.1: тоннаж группы по ISO-неделям в панели мышцы (тело→время). Окно 6
// недель, TZ Europe/Moscow. NOW = воскресенье 2026-06-14 → текущая неделя
// начинается в понедельник 2026-06-08. Окно (oldest→newest):
//   05-04 · 05-11 · 05-18 · 05-25 · 06-01 · 06-08
const NOW = new Date("2026-06-14T12:00:00Z");
const TZ = "Europe/Moscow";
const WEEKS = 6;

// Вторник внутри недели → попадает в её понедельник-бакет.
const inWeek = (mondayLike: string): Date =>
  new Date(`${mondayLike}T10:00:00Z`);
const c = (mondayLike: string, volume: number): WeeklyVolumeContribution => ({
  at: inWeek(mondayLike),
  volume,
});

const series = (contribs: WeeklyVolumeContribution[]) =>
  weeklyVolumeSeries(contribs, NOW, TZ, WEEKS);

describe("weeklyVolumeSeries", () => {
  it("нет вкладов → пустой ряд", () => {
    expect(series([])).toEqual([]);
  });

  it("3 подряд недавние недели → ряд из 3 значений (ведущие нули срезаны)", () => {
    // 05-26→05-25, 06-02→06-01, 06-09→06-08
    expect(series([c("2026-05-26", 100), c("2026-06-02", 200), c("2026-06-09", 300)])).toEqual([
      100, 200, 300,
    ]);
  });

  it("одна средняя неделя → [v] (срезаны и ведущие, и замыкающие нули)", () => {
    // 05-19 → бакет 05-18 (середина окна)
    expect(series([c("2026-05-19", 500)])).toEqual([500]);
  });

  it("пропуск недели внутри отрезка сохраняется нулём", () => {
    // 05-12→05-11 и 06-09→06-08: между ними 3 пустые недели
    expect(series([c("2026-05-12", 90), c("2026-06-09", 40)])).toEqual([
      90, 0, 0, 0, 40,
    ]);
  });

  it("несколько вкладов в одну неделю суммируются", () => {
    expect(series([c("2026-06-09", 30), c("2026-06-10", 70)])).toEqual([100]);
  });

  it("вклад старше окна игнорируется", () => {
    // 04-20 — раньше старейшей недели окна (05-04)
    expect(series([c("2026-04-20", 999)])).toEqual([]);
  });

  it("weeks=0 → пустой ряд", () => {
    expect(weeklyVolumeSeries([c("2026-06-09", 10)], NOW, TZ, 0)).toEqual([]);
  });
});

describe("trimZeroEdges", () => {
  it("срезает ведущие и замыкающие нули, сохраняя внутренние", () => {
    expect(trimZeroEdges([0, 0, 5, 0, 8, 0])).toEqual([5, 0, 8]);
  });

  it("полностью нулевой ряд → []", () => {
    expect(trimZeroEdges([0, 0, 0])).toEqual([]);
  });

  it("без нулей по краям → без изменений", () => {
    expect(trimZeroEdges([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
