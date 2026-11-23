// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  enqueue: vi.fn(), listPending: vi.fn(), loadSetDraft: vi.fn(),
  clearSetDraft: vi.fn(), saveSetDraft: vi.fn(),
}));

vi.mock("@/lib/storage/outbox", () => ({
  enqueue: storage.enqueue, listPending: storage.listPending, makeClientId: () => "local-set-id",
}));
vi.mock("@/lib/storage/set-input-draft", () => ({
  loadSetDraft: storage.loadSetDraft, clearSetDraft: storage.clearSetDraft, saveSetDraft: storage.saveSetDraft,
}));
vi.mock("@/server/actions/workouts", () => ({ recordSetAction: vi.fn(async () => ({ status: "idle" })) }));

import { SetInput } from "./SetInput";

const props = {
  workoutId: "workout", workoutExerciseId: "exercise", nextSetIndex: 0,
  defaultWeightKg: 40, defaultRepsMax: 8, restStartedAt: null,
};

describe("mobile set entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.enqueue.mockResolvedValue(undefined);
    storage.listPending.mockResolvedValue([]);
    storage.loadSetDraft.mockReturnValue(null);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("opens without focusing a number field or triggering the keyboard", () => {
    render(createElement(SetInput, { ...props, onOfflineRecord: vi.fn() }));
    expect(document.activeElement?.tagName).toBe("BODY");
    expect((screen.getByLabelText("Вес, кг") as HTMLInputElement).value).toBe("40");
  });

  it("retains entered values and reports a failed offline write", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const onOfflineRecord = vi.fn();
    render(createElement(SetInput, { ...props, onOfflineRecord }));
    fireEvent.click(screen.getByRole("button", { name: "Завершить подход 1" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Не удалось сохранить подход"));
    expect(onOfflineRecord).not.toHaveBeenCalled();
    expect(storage.clearSetDraft).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Вес, кг") as HTMLInputElement).value).toBe("40");
  });

  it("shows a queued set only after the outbox confirms persistence", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    storage.listPending.mockResolvedValue([{ clientId: "local-set-id" }]);
    const onOfflineRecord = vi.fn();
    render(createElement(SetInput, { ...props, onOfflineRecord }));
    fireEvent.click(screen.getByRole("button", { name: "Завершить подход 1" }));
    await waitFor(() => expect(onOfflineRecord).toHaveBeenCalledOnce());
    expect(onOfflineRecord).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 40, reps: 8 }));
    expect(storage.clearSetDraft).toHaveBeenCalledWith("exercise");
  });
});
