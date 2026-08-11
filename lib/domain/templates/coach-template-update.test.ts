import { describe, expect, it } from "vitest";

import { mergeCoachTemplateItems } from "./coach-template-update";

const current = [
  {
    exerciseId: "exercise-1",
    targetWeightKg: 75,
    myoReps: true,
    myoMiniSets: 3,
    myoMiniReps: 4,
    myoMiniRestSeconds: 25,
    notes: "почти до отказа",
  },
];

describe("mergeCoachTemplateItems", () => {
  it("сохраняет Myo-протокол и прочие необязательные поля при правке целей", () => {
    const [item] = mergeCoachTemplateItems(
      [
        {
          exerciseId: "exercise-1",
          targetSets: 4,
          targetRepsMin: 12,
          targetRepsMax: 15,
          targetRestSeconds: 120,
        },
      ],
      current,
    );

    expect(item).toMatchObject({
      targetWeightKg: 75,
      myoReps: true,
      myoMiniSets: 3,
      myoMiniReps: 4,
      myoMiniRestSeconds: 25,
      notes: "почти до отказа",
    });
  });

  it("уважает явное отключение Myo и ограничивает его отдых 30 секундами", () => {
    const [item] = mergeCoachTemplateItems(
      [
        {
          exerciseId: "exercise-1",
          targetSets: 4,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetRestSeconds: 120,
          myoReps: false,
          myoMiniRestSeconds: 90,
          notes: null,
        },
      ],
      current,
    );

    expect(item).toMatchObject({
      myoReps: false,
      myoMiniRestSeconds: 30,
      notes: null,
    });
  });

  it("использует безопасные дефолты только для нового упражнения", () => {
    const [item] = mergeCoachTemplateItems(
      [
        {
          exerciseId: "exercise-2",
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetRestSeconds: 90,
        },
      ],
      current,
    );

    expect(item).toMatchObject({
      targetWeightKg: null,
      myoReps: false,
      myoMiniSets: 3,
      myoMiniReps: 5,
      myoMiniRestSeconds: 20,
      notes: null,
    });
  });
});
