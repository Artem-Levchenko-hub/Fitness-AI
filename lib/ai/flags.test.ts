import { describe, expect, it } from "vitest";

import { formatFlagsBlock } from "./flags";

describe("formatFlagsBlock", () => {
  it("возвращает null когда нет ни одного флага (R-37: без пустого заголовка)", () => {
    expect(formatFlagsBlock({ stagnant: [], overloaded: [] })).toBeNull();
  });

  it("перечисляет застойные упражнения с числом сессий", () => {
    const block = formatFlagsBlock({
      stagnant: [{ nameRu: "Жим лёжа", streak: 3 }],
      overloaded: [],
    });
    expect(block).toContain("# Флаги");
    expect(block).toContain("Жим лёжа");
    expect(block).toContain("3 сессии");
  });

  it("ru-плюрализация streak (1 сессия / 3 сессии / 5 сессий — паукальная форма)", () => {
    expect(
      formatFlagsBlock({ stagnant: [{ nameRu: "А", streak: 1 }], overloaded: [] }),
    ).toContain("1 сессия");
    expect(
      formatFlagsBlock({ stagnant: [{ nameRu: "Б", streak: 5 }], overloaded: [] }),
    ).toContain("5 сессий");
  });

  it("перечисляет перегруженные группы с числом подходов", () => {
    const block = formatFlagsBlock({
      stagnant: [],
      overloaded: [{ label: "Грудь", weeklySets: 18 }],
    });
    expect(block).toContain("# Флаги");
    expect(block).toContain("Грудь");
    expect(block).toContain("18");
    expect(block).toContain("перегруз");
  });

  it("совмещает оба вида флагов в одном блоке", () => {
    const block = formatFlagsBlock({
      stagnant: [{ nameRu: "Присед", streak: 4 }],
      overloaded: [{ label: "Квадрицепс", weeklySets: 16 }],
    });
    expect(block).toContain("Присед");
    expect(block).toContain("4 сессии");
    expect(block).toContain("Квадрицепс");
    expect(block).toContain("16");
  });

  it("дробное число подходов (secondary 0.5) форматируется с одним знаком", () => {
    const block = formatFlagsBlock({
      stagnant: [],
      overloaded: [{ label: "Спина", weeklySets: 15.5 }],
    });
    expect(block).toContain("15.5");
  });
});
