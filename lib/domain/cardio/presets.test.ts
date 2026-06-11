import { describe, expect, it } from "vitest";

import {
  avgWorkHr,
  PRESET_META,
  presetToBlocks,
  totalPlannedSec,
  type CardioPresetKind,
} from "./presets";

// Характеризационные тесты: фиксируют ТЕКУЩИЙ контракт построения cardio-блоков.
// presetToBlocks задаёт ФАКТИЧЕСКУЮ последовательность работа/отдых, которую юзер
// выполняет в сессии; avgWorkHr питает cardio-статистику и AI-контекст. Любой
// будущий рефактор интервалов / лейблов / фильтра HR ловится здесь.

describe("presetToBlocks › tabata", () => {
  const blocks = presetToBlocks("tabata");

  it("8 раундов × (работа + отдых) = 16 блоков", () => {
    expect(blocks).toHaveLength(16);
  });

  it("первый блок — работа 20с с номером раунда", () => {
    expect(blocks[0]).toEqual({
      kind: "work",
      label: "Работа · раунд 1",
      durationSec: 20,
    });
  });

  it("второй блок — отдых 10с", () => {
    expect(blocks[1]).toEqual({
      kind: "rest",
      label: "Отдых · раунд 1",
      durationSec: 10,
    });
  });

  it("ВКЛЮЧАЕТ финальный отдых (последний блок = rest раунда 8)", () => {
    expect(blocks[15]).toEqual({
      kind: "rest",
      label: "Отдых · раунд 8",
      durationSec: 10,
    });
  });
});

describe("presetToBlocks › norwegian_4x4", () => {
  const blocks = presetToBlocks("norwegian_4x4");

  it("4 раунда × (работа + восстановление) = 8 блоков", () => {
    expect(blocks).toHaveLength(8);
  });

  it("работа 4 мин @ 90-95%", () => {
    expect(blocks[0]).toEqual({
      kind: "work",
      label: "Работа 90-95% · раунд 1",
      durationSec: 240,
    });
  });

  it("последний блок — восстановление 3 мин раунда 4", () => {
    expect(blocks[7]).toEqual({
      kind: "rest",
      label: "Восстановление · раунд 4",
      durationSec: 180,
    });
  });
});

describe("presetToBlocks › emom", () => {
  it("по умолчанию 10 раундов работы по 60с, без отдыха", () => {
    const blocks = presetToBlocks("emom");
    expect(blocks).toHaveLength(10);
    expect(blocks.every((b) => b.kind === "work" && b.durationSec === 60)).toBe(
      true,
    );
    expect(blocks[0].label).toBe("Минута 1");
    expect(blocks[9].label).toBe("Минута 10");
  });

  it("emomRounds переопределяет число раундов", () => {
    expect(presetToBlocks("emom", { emomRounds: 3 })).toHaveLength(3);
  });
});

describe("presetToBlocks › custom", () => {
  it("по умолчанию rounds6/work30/rest60 → 6 работа + 5 отдых = 11 блоков", () => {
    const blocks = presetToBlocks("custom");
    expect(blocks).toHaveLength(11);
  });

  it("ПРОПУСКАЕТ финальный отдых (последний блок = работа)", () => {
    const blocks = presetToBlocks("custom");
    expect(blocks[blocks.length - 1]).toEqual({
      kind: "work",
      label: "Работа · раунд 6",
      durationSec: 30,
    });
  });

  it("restSec=0 → только work-блоки, без отдыха", () => {
    const blocks = presetToBlocks("custom", {
      rounds: 4,
      workSec: 40,
      restSec: 0,
    });
    expect(blocks).toHaveLength(4);
    expect(blocks.every((b) => b.kind === "work")).toBe(true);
  });

  it("rounds=1 → один work-блок, без отдыха", () => {
    const blocks = presetToBlocks("custom", {
      rounds: 1,
      workSec: 25,
      restSec: 60,
    });
    expect(blocks).toEqual([
      { kind: "work", label: "Работа · раунд 1", durationSec: 25 },
    ]);
  });
});

describe("totalPlannedSec", () => {
  it("суммирует длительности всех блоков", () => {
    expect(totalPlannedSec(presetToBlocks("tabata"))).toBe(240);
  });

  it("custom default = 6×30 + 5×60 = 480", () => {
    expect(totalPlannedSec(presetToBlocks("custom"))).toBe(480);
  });

  it("пустой список → 0", () => {
    expect(totalPlannedSec([])).toBe(0);
  });
});

describe("инвариант: PRESET_META.totalSec == фактическая сумма блоков", () => {
  const kinds: Array<Exclude<CardioPresetKind, "custom">> = [
    "tabata",
    "norwegian_4x4",
    "emom",
  ];

  for (const kind of kinds) {
    it(`${kind}: метаданные UI совпадают с построенной сессией`, () => {
      expect(totalPlannedSec(presetToBlocks(kind))).toBe(
        PRESET_META[kind].totalSec,
      );
    });
  }
});

describe("avgWorkHr", () => {
  it("усредняет только work-блоки, rest и null игнорируются", () => {
    const avg = avgWorkHr([
      { kind: "work", hrAvg: 150 },
      { kind: "rest", hrAvg: 200 },
      { kind: "work", hrAvg: 160 },
      { kind: "work", hrAvg: null },
    ]);
    expect(avg).toBe(155);
  });

  it("округляет до целого (Math.round, half up)", () => {
    expect(avgWorkHr([
      { kind: "work", hrAvg: 150 },
      { kind: "work", hrAvg: 151 },
    ])).toBe(151);
  });

  it("нет валидных work-HR → null", () => {
    expect(
      avgWorkHr([
        { kind: "rest", hrAvg: 200 },
        { kind: "work", hrAvg: null },
      ]),
    ).toBeNull();
  });

  it("пустой список → null", () => {
    expect(avgWorkHr([])).toBeNull();
  });
});
