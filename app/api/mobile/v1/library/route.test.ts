import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listPrograms: vi.fn(),
  getProgramWithDays: vi.fn(),
  getTemplateWithItems: vi.fn(),
  listTemplates: vi.fn(),
  setProgramActive: vi.fn(),
  wrapTemplatesIntoProgram: vi.fn(),
  revalidatePath: vi.fn(),
  isAiConfigured: vi.fn(), composeAiPlan: vi.fn(), claimAiCapacity: vi.fn(), settleAiCapacity: vi.fn(),
  listExercises: vi.fn(), createAiProgramForUser: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/training-programs.repo", () => ({
  ...mocks,
  ProgramTemplateNotFound: class extends Error {},
  ProgramCreationConflict: class extends Error {},
}));
vi.mock("@/lib/repos/templates.repo", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/ai/plan-composer", () => mocks);
vi.mock("@/lib/ai/guard", () => mocks);
vi.mock("@/lib/repos/exercises.repo", () => mocks);

import { GET, POST } from "./route";

const accountId = "athlete-1";
const programId = "be4591be-c585-4ded-8b34-fd1e463bcae3";
const dayId = "151e17c8-d101-49f8-8d4a-781e9a4f6fc2";
const otherDayId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";
const clientProgramId = "8a8d6cc9-fb2d-4baf-a19d-ec6cee8d6b33";
const createdAt = new Date("2026-11-17T12:00:00Z");
const day = { templateId: dayId, name: "Верх", dayOrder: 0, exerciseCount: 1, adapted: false };
const program = {
  id: programId,
  name: "Мой план",
  description: "Три дня в неделю",
  librarySlug: null,
  active: false,
  createdAt,
  days: [day],
  review: null,
  reviewedAt: null,
};
const url = "https://fitnesss.online/api/mobile/v1/library";

function fetchLibrary(query = "") {
  return GET(new Request(url + query));
}

function submit(data: object, selectedAccount = accountId) {
  return POST(new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ accountId: selectedAccount, ...data }),
  }));
}

function activate(active = true, selectedAccount = accountId) {
  return submit({ action: "set_active", programId, active }, selectedAccount);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: accountId });
  mocks.listPrograms.mockResolvedValue([{ ...program, dayCount: 1, updatedAt: createdAt }]);
  mocks.getProgramWithDays.mockResolvedValue(program);
  mocks.listTemplates.mockResolvedValue([{ id: dayId, name: "Верх", exerciseCount: 1 }]);
  mocks.isAiConfigured.mockReturnValue(true);
  mocks.claimAiCapacity.mockResolvedValue({ kind: "allowed", usageId: "usage-1" });
  mocks.listExercises.mockResolvedValue([{ slug: "squat", nameRu: "Приседания", primaryMuscles: ["quads"] }]);
  mocks.composeAiPlan.mockResolvedValue({ name: "Персональный план", description: "", days: [] });
  mocks.createAiProgramForUser.mockResolvedValue({ id: clientProgramId });
});

describe("mobile library", () => {
  it("lists only the authenticated account's programs and disables caching", async () => {
    const response = await fetchLibrary();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      accountId,
      programs: [{ id: programId, name: "Мой план", active: false, dayCount: 1 }],
    });
    expect(mocks.listPrograms).toHaveBeenCalledWith(accountId);
  });

  it("reads program detail and keeps its day order", async () => {
    const response = await fetchLibrary(`?programId=${programId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ program: { id: programId, days: [day] } });
    expect(mocks.getProgramWithDays).toHaveBeenCalledWith(accountId, programId);
  });

  it("opens a product guide from the library index", async () => {
    const index = await (await fetchLibrary()).json();
    expect(index.articles).toContainEqual(expect.objectContaining({
      id: "templates-and-programs", title: "Программа и шаблоны",
    }));
    const response = await fetchLibrary("?articleId=templates-and-programs");
    const article = (await response.json()).article;
    expect(article.title).toBe("Программа и шаблоны");
    expect(article.sections[0].text).toContain("Шаблон описывает одну тренировку");
    expect(mocks.getProgramWithDays).not.toHaveBeenCalled();
    expect((await fetchLibrary("?articleId=missing")).status).toBe(404);
  });

  it("does not read a template outside the selected program", async () => {
    const response = await fetchLibrary(`?programId=${programId}&dayId=${otherDayId}`);
    expect(response.status).toBe(404);
    expect(mocks.getTemplateWithItems).not.toHaveBeenCalled();
  });

  it("returns exercises belonging to a plan day", async () => {
    mocks.getTemplateWithItems.mockResolvedValue({
      id: dayId,
      name: "Верх",
      description: "Основные упражнения",
      items: [{
        exerciseNameRu: "Жим лёжа",
        targetSets: 3,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetWeightKg: null,
        targetRestSeconds: 120,
        notes: null,
      }],
    });
    const response = await fetchLibrary(`?programId=${programId}&dayId=${dayId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      day: { id: dayId, active: false, items: [{ name: "Жим лёжа", sets: 3, repsMin: 8, repsMax: 12 }] },
    });
    expect(mocks.getTemplateWithItems).toHaveBeenCalledWith(accountId, dayId);
  });

  it("sets the owned program to the requested state", async () => {
    const response = await activate();
    expect(await response.json()).toEqual({ programId, active: true });
    expect(mocks.setProgramActive).toHaveBeenCalledWith(accountId, programId, true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
  });

  it("acknowledges a retry after the program has already changed state", async () => {
    mocks.getProgramWithDays.mockResolvedValue({ ...program, active: true });
    expect((await activate()).status).toBe(200);
    expect(mocks.setProgramActive).not.toHaveBeenCalled();
  });

  it("rejects requests to activate missing or foreign programs", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    expect((await activate()).status).toBe(404);
    expect(mocks.setProgramActive).not.toHaveBeenCalled();
  });

  it("prohibits carrying program requests across accounts", async () => {
    expect((await activate(true, "other-account")).status).toBe(409);
    expect(mocks.getProgramWithDays).not.toHaveBeenCalled();
  });

  it("offers only templates from the current account as plan inputs", async () => {
    const response = await fetchLibrary("?new=1");
    expect(await response.json()).toEqual({
      accountId, templates: [{ id: dayId, name: "Верх", exerciseCount: 1 }],
    });
    expect(mocks.listTemplates).toHaveBeenCalledWith(accountId);
  });

  it("creates a plan in selected day order with a stable client ID", async () => {
    const templateIds = [dayId, otherDayId];
    mocks.wrapTemplatesIntoProgram.mockResolvedValue({ id: clientProgramId });
    const response = await submit({ action: "create", clientProgramId, name: " Утро ", templateIds });
    expect(await response.json()).toEqual({ programId: clientProgramId });
    expect(mocks.wrapTemplatesIntoProgram).toHaveBeenCalledWith(
      accountId, { name: "Утро", description: null, templateIds }, { id: clientProgramId },
    );
  });

  it("rejects repeated template IDs before creating a program", async () => {
    const response = await submit({
      action: "create", clientProgramId, name: "Неделя", templateIds: [dayId, dayId],
    });
    expect(response.status).toBe(400);
    expect(mocks.wrapTemplatesIntoProgram).not.toHaveBeenCalled();
  });

  it("requires an active session", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await fetchLibrary()).status).toBe(401);
    expect((await activate()).status).toBe(401);
    expect(mocks.listPrograms).not.toHaveBeenCalled();
    expect(mocks.setProgramActive).not.toHaveBeenCalled();
  });

  const aiInput = { action: "ai_create", clientProgramId, intake: {
    goal: "Набрать мышцы", experience: "Год", schedule: "3 раза", equipment: "Зал", limitations: "", notes: "",
  } };

  it("generates an AI program with validated intake, owned catalog and stable request identity", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    const response = await submit(aiInput);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ programId: clientProgramId });
    expect(mocks.claimAiCapacity).toHaveBeenCalledWith({
      userId: accountId, operation: "one_shot", requestKey: `mobile-plan:${accountId}:${clientProgramId}`,
    });
    expect(mocks.listExercises).toHaveBeenCalledWith(accountId, { scope: "system" });
    expect(mocks.composeAiPlan).toHaveBeenCalledWith({ userId: accountId, intake: aiInput.intake, catalog: [
      { slug: "squat", nameRu: "Приседания", primaryMuscles: ["quads"] },
    ] });
    expect(mocks.createAiProgramForUser).toHaveBeenCalledWith(accountId, expect.objectContaining({ name: "Персональный план" }), { id: clientProgramId });
    expect(mocks.settleAiCapacity).toHaveBeenCalledWith("usage-1", true);
  });

  it("acknowledges a completed AI retry without another generation or quota charge", async () => {
    mocks.getProgramWithDays.mockResolvedValue({ ...program, id: clientProgramId });
    expect(await (await submit(aiInput)).json()).toEqual({ programId: clientProgramId });
    expect(mocks.composeAiPlan).not.toHaveBeenCalled();
    expect(mocks.claimAiCapacity).not.toHaveBeenCalled();
  });

  it("enforces Pro and quota before invoking the model", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    mocks.claimAiCapacity.mockResolvedValue({ kind: "subscription_required" });
    const response = await submit(aiInput);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "subscription_required" });
    expect(mocks.composeAiPlan).not.toHaveBeenCalled();
    mocks.claimAiCapacity.mockResolvedValue({ kind: "quota_exceeded", message: "Лимит" });
    expect((await submit(aiInput)).status).toBe(429);
    expect(mocks.createAiProgramForUser).not.toHaveBeenCalled();
  });

  it("keeps processing AI retries from starting another provider call", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    mocks.claimAiCapacity.mockResolvedValue({ kind: "duplicate", status: "processing" });
    const response = await submit(aiInput);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "ai_request_in_progress" });
    expect(mocks.composeAiPlan).not.toHaveBeenCalled();
  });

  it("reports AI availability without exposing provider configuration", async () => {
    const response = await fetchLibrary("?ai=1");
    expect(await response.json()).toEqual({ accountId, aiConfigured: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects malformed intake and disabled AI before charging quota", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    expect((await submit({ ...aiInput, intake: { ...aiInput.intake, goal: "" } })).status).toBe(400);
    mocks.isAiConfigured.mockReturnValue(false);
    expect((await submit(aiInput)).status).toBe(503);
    expect(mocks.claimAiCapacity).not.toHaveBeenCalled();
  });

  it("releases quota when AI generation fails and keeps account checks first", async () => {
    mocks.getProgramWithDays.mockResolvedValue(null);
    mocks.composeAiPlan.mockRejectedValue(new Error("provider down"));
    expect((await submit(aiInput)).status).toBe(502);
    expect(mocks.settleAiCapacity).toHaveBeenCalledWith("usage-1", false);
    vi.clearAllMocks();
    expect((await submit(aiInput, "other-account")).status).toBe(409);
    expect(mocks.claimAiCapacity).not.toHaveBeenCalled();
  });
});
