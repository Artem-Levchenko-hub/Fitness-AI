import { describe, expect, it } from "vitest";

import {
  formatWeeklyMemoryBlock,
  formatWeeklyMovementsBlock,
  formatWeeklyReviewBlock,
  hasWeeklyData,
  selectKeyMovements,
  type WeeklyKeyMovement,
  type WeeklyReviewInput,
} from "./weekly-review";
import type { PastAdvice } from "./trainer-memory";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

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
    sleep: [],
    nutrition: [],
    keyMovements: [],
  };
}

function movement(over: Partial<WeeklyKeyMovement> = {}): WeeklyKeyMovement {
  return {
    exerciseId: "ex-1",
    nameRu: "Жим лёжа",
    nameEn: "Bench Press",
    curTopSet: { weightKg: 82.5, reps: 5 },
    prevTopSet: { weightKg: 80, reps: 5 },
    curE1rm: 92.8,
    prevE1rm: 90,
    deltaE1rm: 2.8,
    isPr: false,
    ...over,
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

  it("hasWeeklyData: есть сессии на этой неделе → true", () => {
    const d = base();
    d.previous = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    expect(hasWeeklyData(d)).toBe(true);
  });

  it("hasWeeklyData: сессии только на прошлой неделе → true", () => {
    const d = base();
    d.current = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    expect(hasWeeklyData(d)).toBe(true);
  });

  it("hasWeeklyData: обе недели пусты → false (не жжём LLM)", () => {
    const d = base();
    d.current = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    d.previous = { sessions: 0, tonnage: 0, sets: 0, muscleVolumes: [] };
    expect(hasWeeklyData(d)).toBe(false);
  });

  it("рендерит блок сна за неделю с часами, когда есть ночи", () => {
    const d = base();
    d.sleep = [
      { date: "2026-06-10", hours: 7.5, quality: 4 },
      { date: "2026-06-11", hours: 6, quality: null },
    ];
    const out = formatWeeklyReviewBlock(d);
    expect(out).toContain("# Сон за неделю");
    expect(out).toContain("2 ноч");
    expect(out).toContain("2026-06-10: 7.5 ч · качество 4/5");
    expect(out).toContain("2026-06-11: 6 ч");
  });

  it("помечает отсутствие сна за неделю явно (тренер вернёт null)", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).toContain("# Сон за неделю");
    expect(out).toContain("нет записей за эту неделю");
  });

  it("рендерит блок питания за неделю с ккал/белком, когда есть дни", () => {
    const d = base();
    d.nutrition = [
      { date: "2026-06-10", kcal: 2400, proteinG: 160 },
      { date: "2026-06-11", kcal: null, proteinG: 150 },
    ];
    const out = formatWeeklyReviewBlock(d);
    expect(out).toContain("# Питание за неделю");
    expect(out).toContain("2026-06-10: 2400 ккал · Б 160");
    expect(out).toContain("2026-06-11: Б 150");
  });

  it("помечает отсутствие питания за неделю явно", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).toContain("# Питание за неделю");
    expect(out.split("# Питание за неделю")[1]).toContain(
      "нет записей за эту неделю",
    );
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

  it("включает переданный блок памяти тренера", () => {
    const memory = "# Память тренера (твой прошлый недельный фокус)\nтест-память";
    const out = formatWeeklyReviewBlock(base(), memory);
    expect(out).toContain("# Память тренера (твой прошлый недельный фокус)");
    expect(out).toContain("тест-память");
  });

  it("без аргумента памяти не содержит блок памяти (обратная совместимость)", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).not.toContain("Память тренера");
  });
});

describe("formatWeeklyMemoryBlock", () => {
  function advice(focus: string | null, score: number | null): PastAdvice {
    return { createdAt: new Date("2026-06-01T12:00:00Z"), focus, score };
  }

  it("нет предшественника (null) → пустая строка (блок опущен)", () => {
    expect(formatWeeklyMemoryBlock(null, fmt)).toBe("");
  });

  it("legacy weekly без focus → пустая строка", () => {
    expect(formatWeeklyMemoryBlock(advice(null, 70), fmt)).toBe("");
  });

  it("есть прошлый фокус → цитирует его, дату и инструкцию pastAdviceFollowUp", () => {
    const out = formatWeeklyMemoryBlock(
      advice("Добавить 1 сессию на ноги: присед 3×8", 72),
      fmt,
    );
    expect(out).toContain("# Память тренера");
    expect(out).toContain("Добавить 1 сессию на ноги: присед 3×8");
    expect(out).toContain("2026-06-01");
    expect(out).toContain("оценка 72/100");
    expect(out).toContain("pastAdviceFollowUp");
    expect(out).toContain("На прошлой неделе я ставил фокус");
  });

  it("опускает оценку, если score null", () => {
    const out = formatWeeklyMemoryBlock(advice("Спать 7.5+ ч", null), fmt);
    expect(out).toContain("Спать 7.5+ ч");
    expect(out).not.toContain("оценка");
  });
});

describe("formatWeeklyMovementsBlock", () => {
  it("пусто → пустая строка (блок опущен)", () => {
    expect(formatWeeklyMovementsBlock([])).toBe("");
  });

  it("выросшее движение: имя, прошлый→текущий сет, e1RM с подписанной дельтой", () => {
    const out = formatWeeklyMovementsBlock([movement()]);
    expect(out).toContain("# Ключевые движения недели");
    expect(out).toContain("Жим лёжа");
    expect(out).toContain("80×5 → 82.5×5");
    expect(out).toContain("e1RM 90.0→92.8 кг");
    expect(out).toContain("+2.8");
  });

  it("PR недели помечается трофеем", () => {
    const out = formatWeeklyMovementsBlock([movement({ isPr: true })]);
    expect(out).toContain("🏆");
    expect(out.toLowerCase()).toContain("pr недели");
  });

  it("новое движение: без дельты, помечено «новое»", () => {
    const out = formatWeeklyMovementsBlock([
      movement({
        prevTopSet: null,
        prevE1rm: null,
        deltaE1rm: null,
        isPr: false,
      }),
    ]);
    expect(out).toContain("новое движение");
    expect(out).toContain("82.5×5");
    expect(out).not.toContain("→ 82.5×5"); // нет сравнения с прошлым
  });
});

describe("selectKeyMovements", () => {
  it("берёт топ-3 по |Δe1RM| (по убыванию модуля)", () => {
    const sel = selectKeyMovements([
      movement({ exerciseId: "a", deltaE1rm: 1 }),
      movement({ exerciseId: "b", deltaE1rm: -9 }),
      movement({ exerciseId: "c", deltaE1rm: 5 }),
      movement({ exerciseId: "d", deltaE1rm: 0.2 }),
    ]);
    expect(sel.map((m) => m.exerciseId)).toEqual(["b", "c", "a"]);
  });

  it("новые движения (нет дельты) тонут ниже движений с дельтой", () => {
    const sel = selectKeyMovements([
      movement({ exerciseId: "new", deltaE1rm: null, prevE1rm: null, curE1rm: 200 }),
      movement({ exerciseId: "small", deltaE1rm: 0.5, curE1rm: 50 }),
    ]);
    expect(sel.map((m) => m.exerciseId)).toEqual(["small", "new"]);
  });
});

describe("formatWeeklyReviewBlock — ключевые движения", () => {
  it("включает блок движений, когда они есть", () => {
    const d = base();
    d.keyMovements = [movement()];
    const out = formatWeeklyReviewBlock(d);
    expect(out).toContain("# Ключевые движения недели");
    expect(out).toContain("Жим лёжа");
  });

  it("опускает блок движений, когда их нет", () => {
    const out = formatWeeklyReviewBlock(base());
    expect(out).not.toContain("# Ключевые движения недели");
  });
});
