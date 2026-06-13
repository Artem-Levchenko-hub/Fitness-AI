import { describe, expect, it } from "vitest";

import { toCardioEditInitial } from "./cardio-edit-initial";

describe("toCardioEditInitial", () => {
  it("custom: полные params подставляются как есть", () => {
    const r = toCardioEditInitial({
      name: "Свой · 8×40/20",
      preset: "custom",
      planJson: { rounds: 8, workSec: 40, restSec: 20 },
    });
    expect(r).toEqual({
      name: "Свой · 8×40/20",
      preset: "custom",
      rounds: 8,
      workSec: 40,
      restSec: 20,
      emomRounds: 10,
    });
  });

  it("custom: null planJson → дефолты presetToBlocks (6/30/60)", () => {
    const r = toCardioEditInitial({
      name: "Свой",
      preset: "custom",
      planJson: null,
    });
    expect(r.rounds).toBe(6);
    expect(r.workSec).toBe(30);
    expect(r.restSec).toBe(60);
  });

  it("emom: emomRounds из params, иначе дефолт 10", () => {
    expect(
      toCardioEditInitial({
        name: "EMOM",
        preset: "emom",
        planJson: { emomRounds: 15 },
      }).emomRounds,
    ).toBe(15);
    expect(
      toCardioEditInitial({ name: "EMOM", preset: "emom", planJson: {} })
        .emomRounds,
    ).toBe(10);
  });

  it("tabata/norwegian: пустой params → только имя значимо, остальное дефолты", () => {
    const t = toCardioEditInitial({
      name: "Tabata",
      preset: "tabata",
      planJson: null,
    });
    expect(t.name).toBe("Tabata");
    expect(t.preset).toBe("tabata");
    const n = toCardioEditInitial({
      name: "Норвежский 4×4",
      preset: "norwegian_4x4",
      planJson: undefined,
    });
    expect(n.name).toBe("Норвежский 4×4");
    expect(n.preset).toBe("norwegian_4x4");
  });
});
