import { describe, expect, it } from "vitest";

import { buildExerciseLinkMap, resolveExerciseHref } from "./exercise-links";

const rows = [
  { exerciseId: "ex-1", exerciseNameRu: "Жим лёжа", exerciseNameEn: "Bench Press" },
  { exerciseId: "ex-2", exerciseNameRu: "Присед", exerciseNameEn: "Squat" },
];

describe("buildExerciseLinkMap", () => {
  it("ключи и по nameRu, и по nameEn", () => {
    const map = buildExerciseLinkMap(rows);
    expect(map["Жим лёжа"]).toBe("ex-1");
    expect(map["Bench Press"]).toBe("ex-1");
    expect(map["Присед"]).toBe("ex-2");
    expect(map["Squat"]).toBe("ex-2");
  });

  it("тримит края имён", () => {
    const map = buildExerciseLinkMap([
      { exerciseId: "ex-3", exerciseNameRu: "  Тяга  ", exerciseNameEn: " Row " },
    ]);
    expect(map["Тяга"]).toBe("ex-3");
    expect(map["Row"]).toBe("ex-3");
  });

  it("дубль имени в тренировке — last-wins", () => {
    const map = buildExerciseLinkMap([
      { exerciseId: "ex-a", exerciseNameRu: "Жим", exerciseNameEn: "Press" },
      { exerciseId: "ex-b", exerciseNameRu: "Жим", exerciseNameEn: "Press2" },
    ]);
    expect(map["Жим"]).toBe("ex-b");
  });

  it("пустые имена пропускаются", () => {
    const map = buildExerciseLinkMap([
      { exerciseId: "ex-x", exerciseNameRu: "", exerciseNameEn: "  " },
    ]);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe("resolveExerciseHref", () => {
  const links = buildExerciseLinkMap(rows);

  it("имя из тренировки → путь к истории", () => {
    expect(resolveExerciseHref("Жим лёжа", links)).toBe("/exercises/ex-1");
  });

  it("тримит имя из строки разбора перед резолвом", () => {
    expect(resolveExerciseHref("  Присед  ", links)).toBe("/exercises/ex-2");
  });

  it("имя не из тренировки → null (fail-soft, без битой ссылки)", () => {
    expect(resolveExerciseHref("Становая", links)).toBeNull();
  });

  it("карта отсутствует (share/friend, ссылки off) → null", () => {
    expect(resolveExerciseHref("Жим лёжа", undefined)).toBeNull();
  });
});
