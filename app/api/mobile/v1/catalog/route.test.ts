import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), listExercises: vi.fn(), listMuscleGroups: vi.fn(), createTemplate: vi.fn(),
  getTemplateWithItems: vi.fn(), updateTemplate: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/exercises.repo", () => ({ listExercises: mocks.listExercises, listMuscleGroups: mocks.listMuscleGroups }));
vi.mock("@/lib/repos/templates.repo", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { GET, POST } from "./route";

const exerciseId = "4672dcbf-c0eb-4841-b63a-6d3ea36bd825";
const templateId = "5824255b-d1b9-40ca-96b7-e33653124946";
const body = {
  accountId: "user-1", templateId, name: "Ноги",
  items: [{ exerciseId, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRestSeconds: 120 }],
};

function submit(payload: object = body) {
  return POST(new Request("https://fitnesss.online/api/mobile/v1/catalog", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: "user-1" });
  mocks.listExercises.mockResolvedValue([{ id: exerciseId, nameRu: "Приседания", ownerUserId: "user-1" }]);
  mocks.listMuscleGroups.mockResolvedValue([]);
  mocks.createTemplate.mockResolvedValue({ id: templateId });
});

describe("mobile catalog", () => {
  it("keeps account-scoped records out of shared caches", async () => {
    const response = await GET();
    const json = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(json.exercises[0]).not.toHaveProperty("ownerUserId");
    expect(mocks.listExercises).toHaveBeenCalledWith("user-1");
  });

  it("passes the stable template ID and validated content to storage", async () => {
    expect((await submit()).status).toBe(200);
    expect(mocks.createTemplate).toHaveBeenCalledWith("user-1", expect.objectContaining({ name: "Ноги" }), { id: templateId });
  });

  it("does not link exercises from another account or write under a switched account", async () => {
    expect((await submit({ ...body, accountId: "user-2" })).status).toBe(409);
    mocks.listExercises.mockResolvedValue([]);
    expect((await submit()).status).toBe(404);
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });

  it("loads an owned template with all editable targets and myoreps intact", async () => {
    const template = { id: templateId, name: "Ноги", description: "План", items: [{
      ...body.items[0], targetWeightKg: 42.5, notes: "Темп", myoReps: true,
      myoMiniSets: 4, myoMiniReps: 6, myoMiniRestSeconds: 15,
    }] };
    mocks.getTemplateWithItems.mockResolvedValue(template);
    const response = await GET(new Request(`https://fitnesss.online/api/mobile/v1/catalog?templateId=${templateId}`));
    expect(await response.json()).toMatchObject({ accountId: "user-1", template });
    expect(mocks.getTemplateWithItems).toHaveBeenCalledWith("user-1", templateId);
  });

  it("replaces the owned template without creating a second template on retry", async () => {
    mocks.getTemplateWithItems.mockResolvedValue({ id: templateId });
    const update = { ...body, action: "update", description: "Описание", items: [{
      ...body.items[0], targetWeightKg: 42.5, notes: "Темп", myoReps: true,
      myoMiniSets: 4, myoMiniReps: 6, myoMiniRestSeconds: 15,
    }] };
    expect((await submit(update)).status).toBe(200);
    expect((await submit(update)).status).toBe(200);
    expect(mocks.createTemplate).not.toHaveBeenCalled();
    expect(mocks.updateTemplate).toHaveBeenCalledWith("user-1", templateId, {
      name: "Ноги", description: "Описание", items: update.items,
    });
  });

  it("rejects editing missing or foreign templates before writing", async () => {
    mocks.getTemplateWithItems.mockResolvedValue(null);
    expect((await submit({ ...body, action: "update" })).status).toBe(404);
    expect(mocks.updateTemplate).not.toHaveBeenCalled();
  });

  it.each([null, ""])("round-trips nullable text and unset weight %j without turning it into zero", async (targetWeightKg) => {
    mocks.getTemplateWithItems.mockResolvedValue({ id: templateId });
    const response = await submit({ ...body, action: "update", description: null, items: [{
      ...body.items[0], notes: null, targetWeightKg,
    }] });
    expect(response.status).toBe(200);
    expect(mocks.updateTemplate).toHaveBeenCalledWith("user-1", templateId, expect.objectContaining({
      description: null, items: [expect.objectContaining({ notes: null, targetWeightKg: null })],
    }));
  });
});
