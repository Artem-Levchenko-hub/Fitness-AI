import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/repos/body.repo", () => ({ updateUserProfile: mocks.update, addMeasurement: vi.fn(), deleteMeasurement: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { updateDisplayNameAction } from "./body";

function form(name?: string) {
  const data = new FormData();
  if (name !== undefined) data.set("name", name);
  data.set("userId", "another-user");
  data.set("heightCm", "240");
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "viewer", email: "anna@example.com", name: null, image: null });
});

describe("save display name", () => {
  it("changes only the signed-in user's name and refreshes dependent screens", async () => {
    expect(await updateDisplayNameAction({ status: "idle" }, form("  Анна  "))).toEqual({ status: "success" });
    expect(mocks.update).toHaveBeenCalledWith("viewer", { name: "Анна" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("clears a saved name without changing body parameters", async () => {
    await updateDisplayNameAction({ status: "idle" }, form(" "));
    expect(mocks.update).toHaveBeenCalledWith("viewer", { name: null });
  });

  it.each([undefined, "а".repeat(81)])("rejects an absent or oversized field without writing", async (name) => {
    expect((await updateDisplayNameAction({ status: "idle" }, form(name))).status).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("never writes when authentication fails", async () => {
    mocks.user.mockRejectedValue(new Error("redirect:/login"));
    await expect(updateDisplayNameAction({ status: "idle" }, form("Анна"))).rejects.toThrow("redirect:/login");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
