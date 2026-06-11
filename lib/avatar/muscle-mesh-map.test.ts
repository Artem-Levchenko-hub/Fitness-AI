import { describe, expect, it } from "vitest";

import { MUSCLE_KEYS } from "../domain/avatar/heat";

import { resolveMuscleKey } from "./muscle-mesh-map";

// Резолвер имён мешей анатомической модели (Z-Anatomy Myology) → 14 групп.
// Критично: различение омонимов (biceps brachii ≠ biceps femoris) и порядок
// правил «специфичное → общее». Ловит регрессии при правке таблицы правил.

describe("resolveMuscleKey — омонимы (порядок правил)", () => {
  it("biceps brachii → biceps (рука), НЕ hamstrings", () => {
    expect(resolveMuscleKey("Biceps_brachii.L")).toBe("biceps");
  });

  it("biceps femoris → hamstrings (бедро), НЕ biceps", () => {
    expect(resolveMuscleKey("Biceps_femoris_R")).toBe("hamstrings");
  });

  it("triceps brachii → triceps (рука), НЕ calves", () => {
    expect(resolveMuscleKey("Triceps_brachii_long_head")).toBe("triceps");
  });

  it("triceps surae → calves (голень), НЕ triceps", () => {
    expect(resolveMuscleKey("Triceps_surae")).toBe("calves");
  });

  it("rectus femoris → quads, rectus abdominis → core", () => {
    expect(resolveMuscleKey("Rectus_femoris")).toBe("quads");
    expect(resolveMuscleKey("Rectus_abdominis")).toBe("core");
  });
});

describe("resolveMuscleKey — латинские имена групп", () => {
  const cases: Array<[string, string]> = [
    ["Pectoralis_major.L", "chest"],
    ["Pectoralis_minor_R", "chest"],
    ["Latissimus_dorsi", "back_lats"],
    ["Trapezius_descending", "back_traps"],
    ["Rhomboid_major", "back_traps"],
    ["Vastus_lateralis", "quads"],
    ["Quadriceps_femoris", "quads"],
    ["Semitendinosus", "hamstrings"],
    ["Semimembranosus", "hamstrings"],
    ["Gastrocnemius_medial_head", "calves"],
    ["Soleus", "calves"],
    ["Gluteus_maximus", "glutes"],
    ["Gluteus_medius", "glutes"],
    ["Brachioradialis", "forearms"],
    ["Flexor_carpi_radialis", "forearms"],
    ["Extensor_digitorum", "forearms"],
    ["External_oblique", "core"],
    ["Rectus_abdominis", "core"],
  ];
  it.each(cases)("%s → %s", (name, key) => {
    expect(resolveMuscleKey(name)).toBe(key);
  });
});

describe("resolveMuscleKey — дельты", () => {
  it("anterior deltoid → shoulders_front", () => {
    expect(resolveMuscleKey("Deltoid_anterior_L")).toBe("shoulders_front");
    expect(resolveMuscleKey("Anterior_deltoid")).toBe("shoulders_front");
  });
  it("posterior deltoid → shoulders_rear", () => {
    expect(resolveMuscleKey("Posterior_deltoid")).toBe("shoulders_rear");
  });
  it("неуточнённый deltoid → shoulders_side (средняя)", () => {
    expect(resolveMuscleKey("Deltoid")).toBe("shoulders_side");
    expect(resolveMuscleKey("Lateral_deltoid")).toBe("shoulders_side");
  });
});

describe("resolveMuscleKey — identity (меши названы нашими ключами)", () => {
  it.each(MUSCLE_KEYS.map((k) => [k] as const))("%s → сам себя", (key) => {
    expect(resolveMuscleKey(key)).toBe(key);
  });

  it("ключ с разделителями (Back-Lats, chest_001) распознаётся", () => {
    expect(resolveMuscleKey("chest_001")).toBe("chest");
    expect(resolveMuscleKey("back_lats.R")).toBe("back_lats");
  });
});

describe("resolveMuscleKey — не-мышцы и мусор → null", () => {
  it.each([["Femur"], ["Skull"], ["Heart"], ["Tendon_xyz"], [""], ["12345"]])(
    "%s → null",
    (name) => {
      expect(resolveMuscleKey(name)).toBeNull();
    },
  );
});
