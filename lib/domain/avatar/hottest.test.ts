import { describe, expect, it } from "vitest";

import { hottestMuscleKey } from "./hottest";

/** Самая горячая группа — цель одноразового пульс-аффорданса H6.5. */
describe("hottestMuscleKey", () => {
  it("пусто → null", () => {
    expect(hottestMuscleKey([])).toBeNull();
  });

  it("все группы остыли (t<=0) → null (пульсировать нечего)", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0, sets: 0 },
        { key: "quads", t: 0, sets: 0 },
      ]),
    ).toBeNull();
  });

  it("единственная активная группа → её ключ", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0, sets: 0 },
        { key: "quads", t: 0.4, sets: 6 },
      ]),
    ).toBe("quads");
  });

  it("выбирает максимальный нагрев t", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0.3, sets: 5 },
        { key: "quads", t: 0.9, sets: 13 },
        { key: "biceps", t: 0.5, sets: 8 },
      ]),
    ).toBe("quads");
  });

  it("равный t → больше подходов выигрывает (тай-брейк)", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0.6, sets: 9 },
        { key: "quads", t: 0.6, sets: 12 },
      ]),
    ).toBe("quads");
  });

  it("равный t и равные подходы → первый по порядку входа", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0.6, sets: 9 },
        { key: "quads", t: 0.6, sets: 9 },
      ]),
    ).toBe("chest");
  });

  it("игнорирует остывшие среди активных", () => {
    expect(
      hottestMuscleKey([
        { key: "chest", t: 0, sets: 0 },
        { key: "quads", t: 0.2, sets: 3 },
        { key: "calves", t: 0, sets: 0 },
      ]),
    ).toBe("quads");
  });
});
