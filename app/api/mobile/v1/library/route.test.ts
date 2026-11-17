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
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/training-programs.repo", () => ({
  ...mocks,
  ProgramTemplateNotFound: class extends Error {},
  ProgramCreationConflict: class extends Error {},
}));
vi.mock("@/lib/repos/templates.repo", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

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
});
