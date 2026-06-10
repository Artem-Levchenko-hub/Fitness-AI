import { describe, expect, it } from "vitest";

import { summarizeVolumeChange } from "./period-insight";

describe("summarizeVolumeChange", () => {
  it("previous=null (range='all') → new, нет процента", () => {
    const r = summarizeVolumeChange(5000, null, "all");
    expect(r.status).toBe("new");
    expect(r.pct).toBeNull();
    expect(r.detail).toMatch(/не с чем сравнить/i);
  });

  it("previous=0 → new (нет базы, без ложного прогресса)", () => {
    const r = summarizeVolumeChange(1000, 0, "30d");
    expect(r.status).toBe("new");
    expect(r.pct).toBeNull();
  });

  it("рост выше порога → improved + положительный процент", () => {
    const r = summarizeVolumeChange(1000, 500, "30d");
    expect(r.status).toBe("improved");
    expect(r.pct).toBe(100);
    expect(r.headline).toMatch(/растёшь/i);
    expect(r.detail).toContain("месяц");
    expect(r.detail).toContain("100%");
  });

  it("падение объёма → regressed + отрицательный процент", () => {
    const r = summarizeVolumeChange(400, 1000, "7d");
    expect(r.status).toBe("regressed");
    expect(r.pct).toBe(-60);
    expect(r.detail).toContain("неделю");
    expect(r.detail).toContain("60%");
  });

  it("изменение в пределах порога (5%) → stagnant", () => {
    const r = summarizeVolumeChange(1020, 1000, "30d");
    expect(r.status).toBe("stagnant");
    expect(r.headline).toMatch(/держишь уровень/i);
  });

  it("ровно на пороге (+5%) → stagnant (epsilon включительно)", () => {
    const r = summarizeVolumeChange(1050, 1000, "90d");
    expect(r.status).toBe("stagnant");
    expect(r.detail).toContain("3 месяца");
  });

  it("чуть выше порога (+6%) → improved", () => {
    const r = summarizeVolumeChange(1060, 1000, "365d");
    expect(r.status).toBe("improved");
    expect(r.pct).toBe(6);
    expect(r.detail).toContain("год");
  });

  it("текущий объём 0 при наличии прошлого → regressed -100%", () => {
    const r = summarizeVolumeChange(0, 800, "30d");
    expect(r.status).toBe("regressed");
    expect(r.pct).toBe(-100);
  });
});
