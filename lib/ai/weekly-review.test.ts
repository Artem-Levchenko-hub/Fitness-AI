import { describe, expect, it } from "vitest";

import { formatWeeklyReviewBlock, type WeeklyReviewInput } from "./weekly-review";

function base(): WeeklyReviewInput {
  return {
    weekStart: "2026-06-08",
    prevWeekStart: "2026-06-01",
    current: {
      sessions: 3,
      tonnage: 12000,
      sets: 45,
      muscleVolumes: [
        { muscleKey: "chest", volume: 5000 },
        { muscleKey: "triceps", volume: 2000 },
      ],
    },
    previous: {
      sessions: 2,
      tonnage: 10000,
      sets: 36,
      muscleVolumes: [{ muscleKey: "chest", volume: 4000 }],
    },
    cycleNote: null,
  };
}

describe("formatWeeklyReviewBlock", () => {
  it("показывает сессии и тоннаж с дельтой к прошлой неделе", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).toContain("Силовых сессий: 3 (прошлая неделя: 2)");
    // 12000 vs 10000 = +20%
    expect(out).toContain("12000 кг·повт vs 10000 кг·повт неделей раньше (+20%)");
    expect(out).toContain("Рабочих подходов: 45 (прошлая: 36)");
  });

  it("показывает группы мышц с RU-названиями и обеими неделями", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).toContain("Грудь: 5000 ← 4000 кг·повт");
    // группа есть в текущей, нет в прошлой → было 0
    expect(out).toContain("Трицепс: 2000 ← 0 кг·повт");
  });

  it("при нулевой прошлой неделе не печатает NaN/−100%, а словесный фолбэк", () => {
    const d = base();
    d.previous = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    const out = formatWeeklyReviewBlock(d);
    expect(out).not.toContain("NaN");
    expect(out).not.toContain("%)"); // нет процентной дельты
    expect(out).toContain("нет данных для сравнения");
  });

  it("при нулевой текущей неделе помечает разгрузку/отдых", () => {
    const d = base();
    d.current = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    const out = formatWeeklyReviewBlock(d);
    expect(out).toContain("Силовых сессий на этой неделе: 0");
    expect(out).toContain("разгрузка или отдых");
  });

  it("включает заметку недели, если она есть", () => {
    const d = base();
    d.cycleNote = "Чувствую себя свежо, добавил сон.";
    const out = formatWeeklyReviewBlock(d);
    expect(out).toContain("## Заметка недели атлета");
    expect(out).toContain("Чувствую себя свежо");
  });

  it("опускает заметку недели, если её нет/пустая", () => {
    const d = base();
    d.cycleNote = "   ";
    const out = formatWeeklyReviewBlock(d);
    expect(out).not.toContain("## Заметка недели атлета");
  });

  it("ограничивает число групп мышц бюджетом (<=8 строк)", () => {
    const d = base();
    d.current.muscleVolumes = Array.from({ length: 12 }, (_, i) => ({
      muscleKey: `m${i}`,
      volume: 1000 - i,
    }));
    const out = formatWeeklyReviewBlock(d);
    const rows = out.split("\n").filter((l) => l.startsWith("- "));
    expect(rows.length).toBeLessThanOrEqual(8);
  });
});
