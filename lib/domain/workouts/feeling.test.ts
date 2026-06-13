import { describe, expect, it } from "vitest";

import { FEELING_TAGS, feelingNoteLine } from "./feeling";

describe("FEELING_TAGS", () => {
  it("содержит ровно 3 тега в порядке возрастания тяжести", () => {
    expect(FEELING_TAGS.map((t) => t.key)).toEqual(["easy", "normal", "hard"]);
  });

  it("каждый тег имеет непустую подпись", () => {
    for (const t of FEELING_TAGS) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe("feelingNoteLine", () => {
  it("строит строку-заметку для валидных тегов", () => {
    expect(feelingNoteLine("easy")).toBe("Самочувствие после сессии: легко");
    expect(feelingNoteLine("normal")).toBe("Самочувствие после сессии: норм");
    expect(feelingNoteLine("hard")).toBe("Самочувствие после сессии: тяжело");
  });

  it("невалидный тег → null (fail-soft)", () => {
    expect(feelingNoteLine("medium")).toBeNull();
    expect(feelingNoteLine("EASY")).toBeNull();
    expect(feelingNoteLine("")).toBeNull();
    expect(feelingNoteLine("normal ")).toBeNull();
  });
});
