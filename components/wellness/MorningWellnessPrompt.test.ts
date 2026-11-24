// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", status: vi.fn(), save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/actions/morning-wellness", () => ({ getMorningWellnessStatus: mocks.status, saveMorningWellnessAction: mocks.save }));

import { MorningWellnessPrompt } from "./MorningWellnessPrompt";

const status = { date: "2026-11-24", proteinDate: "2026-11-23", timeZone: "Europe/Moscow", sleepRecorded: false, proteinRecorded: false };
let userSequence = 0;
function prompt(userId = `wellness-user-${++userSequence}`) {
  return createElement(MorningWellnessPrompt, { userId, timeZone: "Europe/Moscow" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
  mocks.pathname = "/dashboard";
  mocks.status.mockResolvedValue(status);
  mocks.save.mockResolvedValue({ status: "success" });
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("morning wellness dialog", () => {
  it("opens with accessible labels for last night and yesterday's protein", async () => {
    render(prompt());
    await screen.findByRole("dialog", { name: "Доброе утро" });
    expect(screen.getByLabelText("Сон за прошедшую ночь, ч")).toBeTruthy();
    expect(screen.getByLabelText("Белок за вчера, г")).toBeTruthy();
    expect(screen.getByText(/23 ноября/)).toBeTruthy();
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });

  it("saves one field and does not repeat after reload with the other still missing", async () => {
    const userId = `partial-${++userSequence}`;
    const mounted = render(prompt(userId));
    fireEvent.change(await screen.findByLabelText("Белок за вчера, г"), { target: { value: "135" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const payload = mocks.save.mock.calls[0][0] as FormData;
    expect(payload.get("date")).toBe("2026-11-24");
    expect(payload.get("hours")).toBe("");
    expect(payload.get("proteinG")).toBe("135");
    mounted.unmount(); render(prompt(userId));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.status).toHaveBeenCalledTimes(1);
  });

  it("allows skipping today and opens on the next morning in a retained app layout", async () => {
    render(prompt());
    fireEvent.click(await screen.findByRole("button", { name: "Пропустить сегодня" }));
    expect(mocks.save).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-11-25T03:00:00Z"));
    mocks.status.mockResolvedValue({ ...status, date: "2026-11-25", proteinDate: "2026-11-24" });
    fireEvent.focus(window);
    await screen.findByRole("dialog");
    expect(screen.getByText(/24 ноября/)).toBeTruthy();
  });

  it("defers until a safe section and closes immediately when entering a workout", async () => {
    mocks.pathname = "/workouts/active-workout";
    const userId = `navigation-${++userSequence}`;
    const mounted = render(prompt(userId));
    expect(mocks.status).not.toHaveBeenCalled();
    mocks.pathname = "/dashboard"; mounted.rerender(prompt(userId));
    await screen.findByRole("dialog");
    mocks.pathname = "/workouts/active-workout";
    mounted.rerender(prompt(userId));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("retains the dialog and entered values when saving fails", async () => {
    mocks.save.mockResolvedValue({ status: "error", message: "Не удалось сохранить" });
    render(prompt());
    fireEvent.change(await screen.findByLabelText("Сон за прошедшую ночь, ч"), { target: { value: "7.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Не удалось сохранить");
    expect((screen.getByLabelText("Сон за прошедшую ночь, ч") as HTMLInputElement).value).toBe("7.5");
  });
});
