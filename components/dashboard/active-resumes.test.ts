import { describe, expect, it } from "vitest";

import { buildResumes } from "./active-resumes";

/** H2-cleanup: buildResumes — единственный носитель подписей resume-баннеров
 *  (одна правда для дашборда/ /workouts и глобальной полосы). После снятия
 *  мёртвой проводки «Убрать» (жила только в неотрисованном ResumeBanner;
 *  отмена реально достижима из карточки самой сессии) запись = строго
 *  {href,label}, без cancel. */
describe("buildResumes", () => {
  it("returns one navigation entry per active session, in order", () => {
    expect(
      buildResumes({
        activeId: "w1",
        activeCircuitId: "c1",
        activeCardioId: "k1",
      }),
    ).toEqual([
      { href: "/workouts/w1", label: "Активная тренировка" },
      { href: "/circuits/c1", label: "Активная круговая" },
      { href: "/cardio/k1", label: "Активная кардио-сессия" },
    ]);
  });

  it("filters out inactive formats", () => {
    expect(
      buildResumes({
        activeId: null,
        activeCircuitId: "c1",
        activeCardioId: null,
      }),
    ).toEqual([{ href: "/circuits/c1", label: "Активная круговая" }]);
  });

  it("returns empty array when nothing is active", () => {
    expect(
      buildResumes({
        activeId: null,
        activeCircuitId: null,
        activeCardioId: null,
      }),
    ).toEqual([]);
  });
});
