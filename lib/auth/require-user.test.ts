import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn() }));
vi.mock("./index", () => ({ auth: mocks.auth }));
vi.mock("@/lib/repos/body.repo", () => ({ getUserProfile: mocks.profile }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

import { getUser, requireUser } from "./require-user";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "viewer", email: "anna@example.com", name: "Old JWT name", image: null } });
  mocks.profile.mockResolvedValue({ id: "viewer", email: "anna@example.com", name: "Анна" });
});

describe("current profile identity", () => {
  it("shows a saved display name without another sign-in", async () => {
    expect(await requireUser()).toEqual({ id: "viewer", email: "anna@example.com", name: "Анна", image: null });
  });

  it("keeps a cleared name null instead of resurrecting the JWT name", async () => {
    mocks.profile.mockResolvedValue({ id: "viewer", email: "anna@example.com", name: null });
    expect((await getUser())?.name).toBeNull();
  });

  it("does not accept a session for an account that no longer exists", async () => {
    mocks.profile.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/login");
    expect(await getUser()).toBeNull();
  });
});
