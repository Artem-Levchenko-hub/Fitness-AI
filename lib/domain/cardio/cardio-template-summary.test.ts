import { describe, expect, it } from "vitest";

import { summarizeCardioTemplate } from "./cardio-template-summary";

describe("summarizeCardioTemplate", () => {
  it("returns fixed name for tabata (params ignored)", () => {
    expect(summarizeCardioTemplate("tabata", {})).toBe("Tabata");
    expect(summarizeCardioTemplate("tabata", null)).toBe("Tabata");
  });

  it("returns fixed name for norwegian_4x4", () => {
    expect(summarizeCardioTemplate("norwegian_4x4", null)).toBe(
      "Норвежский 4×4",
    );
  });

  it("summarizes emom with explicit rounds", () => {
    expect(summarizeCardioTemplate("emom", { emomRounds: 12 })).toBe(
      "EMOM 12 мин",
    );
  });

  it("falls back to emom default rounds when params missing", () => {
    expect(summarizeCardioTemplate("emom", null)).toBe("EMOM 10 мин");
    expect(summarizeCardioTemplate("emom", {})).toBe("EMOM 10 мин");
  });

  it("summarizes custom intervals from params", () => {
    expect(
      summarizeCardioTemplate("custom", {
        rounds: 6,
        workSec: 30,
        restSec: 60,
      }),
    ).toBe("Свой · 6×30/60с");
  });

  it("falls back to custom defaults when params partial/null", () => {
    expect(summarizeCardioTemplate("custom", null)).toBe("Свой · 6×30/60с");
    expect(summarizeCardioTemplate("custom", { workSec: 45 })).toBe(
      "Свой · 6×45/60с",
    );
  });
});
