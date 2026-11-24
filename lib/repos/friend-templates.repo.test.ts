import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), strengthList: vi.fn(), strength: vi.fn(), circuitList: vi.fn(), circuit: vi.fn(),
  cardioList: vi.fn(), cardio: vi.fn(), exercises: vi.fn(),
}));
vi.mock("@/lib/repos/friends.repo", () => ({ getFriendProfile: mocks.profile }));
vi.mock("@/lib/repos/templates.repo", () => ({ listTemplates: mocks.strengthList, getTemplateWithItems: mocks.strength }));
vi.mock("@/lib/repos/circuit-templates.repo", () => ({ listCircuitTemplates: mocks.circuitList, getCircuitTemplateForEdit: mocks.circuit }));
vi.mock("@/lib/repos/cardio-templates.repo", () => ({ listCardioTemplates: mocks.cardioList, getCardioTemplateForEdit: mocks.cardio }));
vi.mock("@/lib/repos/exercises.repo", () => ({ listExercises: mocks.exercises }));

import { getSharedFriendTemplate } from "./friend-templates.repo";

const listed = { id: "template", name: "День друга", description: "План", updatedAt: new Date(), exerciseCount: 1 };
const friend = { id: "friend", name: "Анна", email: "anna@example.com", sharesPrograms: true, heightCm: null, weightKg: null };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.profile.mockImplementation(async (viewer, owner) => viewer === "viewer" && owner === "friend" ? friend : null);
  mocks.strengthList.mockResolvedValue([listed]);
  mocks.circuitList.mockResolvedValue([listed]);
  mocks.cardioList.mockResolvedValue([{ ...listed, metaLine: "Свой · 2×30/60с" }]);
  mocks.strength.mockImplementation(async (owner, id) => owner === "friend" && id === "template" ? {
    id, name: listed.name, description: listed.description, createdAt: new Date(), updatedAt: new Date(),
    lastAdaptedWorkoutId: null, adaptedAt: null, canRevert: false,
    items: [{ id: "item", exerciseId: "squat", position: 0, exerciseNameRu: "Приседания", exerciseNameEn: "Squat", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 40, targetRestSeconds: 90, myoReps: false, myoMiniSets: 3, myoMiniReps: 4, myoMiniRestSeconds: 20, notes: "Ровная спина" }],
  } : null);
});

describe("shared friend templates", () => {
  it.each(["strength", "circuit", "cardio"].flatMap((format) => [{ format, profile: null }, { format, profile: { ...friend, sharesPrograms: false } }]))("denies a direct URL without both friendship and sharing: $format $profile", async ({ format, profile }) => {
    mocks.profile.mockResolvedValue(profile);
    await expect(getSharedFriendTemplate("viewer", "friend", format, "template")).resolves.toBeNull();
    expect(mocks.strengthList).not.toHaveBeenCalled();
    expect(mocks.strength).not.toHaveBeenCalled();
    expect(mocks.circuit).not.toHaveBeenCalled();
    expect(mocks.cardio).not.toHaveBeenCalled();
  });

  it("loads the friend's exercise targets using the template owner's scope", async () => {
    const result = await getSharedFriendTemplate("viewer", "friend", "strength", "template");
    expect(result?.name).toBe("День друга");
    expect(result?.exercises).toEqual([{ id: "item", name: "Приседания", target: "3×8–12 · 40 кг · отдых 90с", notes: "Ровная спина" }]);
  });

  it.each(["strength", "circuit", "cardio"])("denies archived, hidden or other-owner %s IDs absent from the shared list", async (format) => {
    mocks.strengthList.mockResolvedValue([]);
    mocks.circuitList.mockResolvedValue([]);
    mocks.cardioList.mockResolvedValue([]);
    expect(await getSharedFriendTemplate("viewer", "friend", format, "template")).toBeNull();
    expect(mocks.strength).not.toHaveBeenCalled();
    expect(mocks.circuit).not.toHaveBeenCalled();
    expect(mocks.cardio).not.toHaveBeenCalled();
  });

  it("opens circuit repetitions and timed exercises with the friend's custom exercise names", async () => {
    mocks.circuit.mockImplementation(async (owner, id) => owner === "friend" && id === "template" ? {
      id, name: "Круг", totalRounds: 4, restBetweenRoundsSec: 120, restBetweenExercisesSec: 30,
      exercises: [{ id: "item", exerciseId: "custom", orderIdx: 0, kind: "duration", targetDurationSec: 45, targetReps: null, targetWeightKg: null, notes: null }],
    } : null);
    mocks.exercises.mockImplementation(async (owner) => owner === "friend" ? [{ id: "custom", nameRu: "Моя планка" }] : []);
    const result = await getSharedFriendTemplate("viewer", "friend", "circuit", "template");
    expect(result?.summary).toContain("Кругов: 4");
    expect(result?.exercises).toEqual([{ id: "item", name: "Моя планка", target: "45с", notes: null }]);
  });

  it("opens the exact cardio intervals without creating a workout", async () => {
    mocks.cardio.mockImplementation(async (owner, id) => owner === "friend" && id === "template" ? { id, name: "Интервалы", preset: "custom", planJson: { rounds: 2, workSec: 30, restSec: 60 } } : null);
    const result = await getSharedFriendTemplate("viewer", "friend", "cardio", "template");
    expect(result?.blocks).toEqual([
      { kind: "work", label: "Работа · раунд 1", durationSec: 30 },
      { kind: "rest", label: "Отдых · после раунда 1", durationSec: 60 },
      { kind: "work", label: "Работа · раунд 2", durationSec: 30 },
    ]);
  });

  it("denies a template removed between listing and loading", async () => {
    mocks.strength.mockResolvedValue(null);
    expect(await getSharedFriendTemplate("viewer", "friend", "strength", "template")).toBeNull();
  });

  it("rejects an unsupported format", async () => {
    expect(await getSharedFriendTemplate("viewer", "friend", "unknown", "template")).toBeNull();
  });
});
