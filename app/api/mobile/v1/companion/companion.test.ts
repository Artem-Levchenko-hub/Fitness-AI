import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listSchedules: vi.fn(),
  createSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  setScheduleEnabled: vi.fn(),
  listTemplates: vi.fn(),
  listCircuits: vi.fn(),
  listRecentCardio: vi.fn(),
  listFriendsActivity: vi.fn(),
  listIncomingRequestsDetailed: vi.fn(),
  listOutgoingRequestsDetailed: vi.fn(),
  getShareProgramsWithFriends: vi.fn(),
  setShareProgramsWithFriends: vi.fn(),
  findUserByEmail: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  listAccountNotes: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/schedule.repo", () => mocks);
vi.mock("@/lib/repos/templates.repo", () => mocks);
vi.mock("@/lib/repos/circuits.repo", () => mocks);
vi.mock("@/lib/repos/cardio.repo", () => mocks);
vi.mock("@/lib/repos/friends.repo", () => mocks);
vi.mock("./notes/notes", () => ({ listAccountNotes: mocks.listAccountNotes }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { GET as friends, POST as changeFriend } from "./friends/route";
import { GET as notes } from "./notes/route";
import { GET as schedule, POST as changeSchedule } from "./schedule/route";

const owner = { id: "owner-1", name: null, email: "owner@example.org", image: null };
const accountId = owner.id;
const dated = new Date("2026-11-17T12:00:00Z");

function submit(body: object) {
  return new Request("https://fitnesss.online/api/mobile/v1/companion", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue(owner);
  mocks.listSchedules.mockResolvedValue([]);
  mocks.listTemplates.mockResolvedValue([]);
  mocks.listCircuits.mockResolvedValue([]);
  mocks.listRecentCardio.mockResolvedValue([]);
  mocks.listFriendsActivity.mockResolvedValue([]);
  mocks.listIncomingRequestsDetailed.mockResolvedValue([]);
  mocks.listOutgoingRequestsDetailed.mockResolvedValue([]);
  mocks.getShareProgramsWithFriends.mockResolvedValue(false);
  mocks.listAccountNotes.mockResolvedValue([]);
});

describe("native companion pages", () => {
  it("requires a session for the three lists and account mutations", async () => {
    mocks.getUser.mockResolvedValue(null);
    const responses = await Promise.all([
      schedule(), friends(), notes(),
      changeSchedule(submit({ accountId, action: "delete", id: "schedule-1" })),
      changeFriend(submit({ accountId, action: "share", enabled: true })),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
    expect(mocks.listSchedules).not.toHaveBeenCalled();
    expect(mocks.listFriendsActivity).not.toHaveBeenCalled();
    expect(mocks.listAccountNotes).not.toHaveBeenCalled();
    expect(mocks.deleteSchedule).not.toHaveBeenCalled();
    expect(mocks.setShareProgramsWithFriends).not.toHaveBeenCalled();
  });

  it("rejects mutations submitted under a different account", async () => {
    const accountId = "old-session";
    expect((await changeSchedule(submit({ accountId, action: "toggle", id: "schedule-1", enabled: false }))).status).toBe(409);
    expect((await changeFriend(submit({ accountId, action: "accept", id: "friendship-1" }))).status).toBe(409);
    expect(mocks.setScheduleEnabled).not.toHaveBeenCalled();
    expect(mocks.acceptFriendRequest).not.toHaveBeenCalled();
  });

  it("uses owned schedule data and validates create, toggle, and delete", async () => {
    mocks.createSchedule.mockResolvedValue({ id: "schedule-1" });
    mocks.listSchedules.mockResolvedValue([
      { id: "schedule-1", userId: accountId, label: "Ноги", daysOfWeek: [1, 4], hour: 18, enabled: true,
        templateId: "preset-1", circuitWorkoutId: null, cardioWorkoutId: null, createdAt: dated, updatedAt: dated },
    ]);
    mocks.listTemplates.mockResolvedValue([{ id: "preset-1", name: "День ног" }]);
    const response = await schedule();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      accountId,
      schedules: [{ id: "schedule-1", label: "Ноги", daysLabel: "Пн · Чт", hourLabel: "18:00", presetLabel: "День ног" }],
    });
    expect(mocks.listSchedules).toHaveBeenCalledWith(accountId);
    expect((await changeSchedule(submit({ accountId, action: "create", label: " Ноги ", daysOfWeek: [4, 1, 4], hour: 18, preset: "template:preset-1" }))).status).toBe(201);
    expect(mocks.createSchedule).toHaveBeenCalledWith(accountId, {
      label: "Ноги", daysOfWeek: [1, 4], hour: 18, preset: { kind: "template", id: "preset-1" },
    });
    expect((await changeSchedule(submit({ accountId, action: "toggle", id: "schedule-1", enabled: false }))).status).toBe(200);
    expect((await changeSchedule(submit({ accountId, action: "delete", id: "schedule-1" }))).status).toBe(200);
    expect(mocks.setScheduleEnabled).toHaveBeenCalledWith(accountId, "schedule-1", false);
    expect(mocks.deleteSchedule).toHaveBeenCalledWith(accountId, "schedule-1");
  });

  it("rejects non-numeric day and hour values from JSON schedule clients", async () => {
    const valid = { accountId, action: "create", label: "Ноги", daysOfWeek: [1], hour: 18 };
    expect((await changeSchedule(submit({ ...valid, hour: null }))).status).toBe(400);
    expect((await changeSchedule(submit({ ...valid, daysOfWeek: [true] }))).status).toBe(400);
    expect(mocks.createSchedule).not.toHaveBeenCalled();
  });

  it("scopes friend lists and actions to the current session", async () => {
    const friend = { id: "friend-1", name: "Лена", email: "friend@example.org" };
    mocks.listIncomingRequestsDetailed.mockResolvedValue([{ friendshipId: "link-1", user: friend, createdAt: dated }]);
    mocks.getShareProgramsWithFriends.mockResolvedValue(true);
    mocks.findUserByEmail.mockResolvedValue(friend);
    mocks.acceptFriendRequest.mockResolvedValue(true);
    const response = await friends();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ accountId, sharesPrograms: true, incoming: [{ id: "link-1", name: "Лена" }] });
    expect(mocks.listIncomingRequestsDetailed).toHaveBeenCalledWith(accountId);
    expect((await changeFriend(submit({ accountId, action: "invite", email: " FRIEND@example.org " }))).status).toBe(200);
    expect(mocks.findUserByEmail).toHaveBeenCalledWith("friend@example.org");
    expect(mocks.sendFriendRequest).toHaveBeenCalledWith(accountId, friend.id);
    expect((await changeFriend(submit({ accountId, action: "accept", id: "link-1" }))).status).toBe(200);
    expect(mocks.acceptFriendRequest).toHaveBeenCalledWith(accountId, "link-1");
    expect((await changeFriend(submit({ accountId, action: "share", enabled: false }))).status).toBe(200);
    expect(mocks.setShareProgramsWithFriends).toHaveBeenCalledWith(accountId, false);
  });

  it("serves existing notes in a private response scoped to the current session", async () => {
    mocks.listAccountNotes.mockResolvedValue([
      { id: "note-1", kind: "workout", title: "Ноги", content: "Подтянуть технику", source: "manual", updatedAt: dated },
    ]);
    const response = await notes();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ accountId, notes: [
      { id: "note-1", kind: "workout", title: "Ноги", content: "Подтянуть технику", source: "manual", updatedAt: dated.toISOString() },
    ] });
    expect(mocks.listAccountNotes).toHaveBeenCalledWith(accountId);
  });
});
