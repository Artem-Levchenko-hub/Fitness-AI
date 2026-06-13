import { describe, expect, it } from "vitest";

import { type ResumeView, visibleResumes } from "./resume-visibility";

const strength: ResumeView = {
  href: "/workouts/aaa",
  label: "Активная тренировка",
};
const circuit: ResumeView = {
  href: "/circuits/bbb",
  label: "Активная круговая",
};

describe("visibleResumes (глобальная полоса возобновления, H12.4)", () => {
  it("скрывает полосу на странице САМОЙ активной сессии (href===pathname)", () => {
    expect(visibleResumes([strength], "/workouts/aaa")).toEqual([]);
  });

  it("показывает полосу на списке /workouts (не страница сессии)", () => {
    expect(visibleResumes([strength], "/workouts")).toEqual([strength]);
  });

  it("показывает полосу на чужой ЗАВЕРШЁННОЙ сессии /workouts/<completedId>", () => {
    // Точный предикат: скрываем только активный id, не любой [id].
    expect(visibleResumes([strength], "/workouts/zzz")).toEqual([strength]);
  });

  it("при двух параллельных сессиях на странице одной — вторая остаётся (столп 4, не теряем молча)", () => {
    expect(visibleResumes([strength, circuit], "/workouts/aaa")).toEqual([
      circuit,
    ]);
  });

  it("на не-сессионной странице видны все активные полосы", () => {
    expect(visibleResumes([strength, circuit], "/exercises")).toEqual([
      strength,
      circuit,
    ]);
  });

  it("нет активных сессий — пусто", () => {
    expect(visibleResumes([], "/dashboard")).toEqual([]);
  });
});
