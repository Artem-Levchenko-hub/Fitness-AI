import { describe, expect, it } from "vitest";

import { summarizeSessionMuscles } from "./session-muscles";

describe("summarizeSessionMuscles", () => {
  it("пустой вход → пустые keys и label", () => {
    expect(summarizeSessionMuscles([])).toEqual({ keys: [], label: "" });
  });

  it("отбрасывает неизвестные ключи (нет в MUSCLE_KEYS)", () => {
    expect(summarizeSessionMuscles(["chest", "left_pinky", "quads"])).toEqual({
      keys: ["chest", "quads"],
      label: "Грудь, Квадрицепс",
    });
  });

  it("дедуплицирует повторы группы", () => {
    expect(summarizeSessionMuscles(["chest", "chest", "triceps"]).keys).toEqual([
      "chest",
      "triceps",
    ]);
  });

  it("упорядочивает по каноническому MUSCLE_KEYS, а не по порядку входа", () => {
    // вход quads→chest, но chest идёт раньше quads в MUSCLE_KEYS
    expect(summarizeSessionMuscles(["quads", "chest"]).keys).toEqual([
      "chest",
      "quads",
    ]);
  });

  it("строит RU-подпись через muscleLabelRu", () => {
    expect(summarizeSessionMuscles(["chest", "triceps"]).label).toBe(
      "Грудь, Трицепс",
    );
  });
});
