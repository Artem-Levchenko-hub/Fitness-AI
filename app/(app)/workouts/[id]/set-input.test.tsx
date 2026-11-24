// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OutboxMutation } from "@/lib/storage/outbox";

const storage = vi.hoisted(() => ({ queue: [] as OutboxMutation[] }));
const actions = vi.hoisted(() => ({ recordSetAction: vi.fn().mockResolvedValue({ status: "idle" }) }));
vi.mock("@/lib/storage/outbox", () => ({
  makeClientId: () => "18b7e149-304e-4646-a075-45247a2cc308",
  enqueue: async (mutation: OutboxMutation) => { storage.queue.push(mutation); },
  listPending: async () => storage.queue,
}));
vi.mock("@/server/actions/workouts", () => actions);

import { SetInput } from "@/components/app/SetInput";

const props = {
  workoutId: "c4ee3b86-7e13-4fa8-8e85-9a371f8534ee", workoutExerciseId: "original-row",
  nextSetIndex: 1, defaultWeightKg: 40, defaultRepsMax: 12, restStartedAt: null,
};

beforeEach(() => {
  storage.queue.length = 0;
  localStorage.clear();
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("set effort capture", () => {
  it("allows one check mark, switches marks and clears the repeated selection", () => {
    render(<SetInput {...props} onOfflineRecord={() => undefined} />);
    const near = screen.getByRole("button", { name: "Полуотказ" });
    const failure = screen.getByRole("button", { name: "Отказ" });
    fireEvent.click(near);
    expect(near.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(failure);
    expect(near.getAttribute("aria-pressed")).toBe("false");
    expect(failure.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(failure);
    expect(failure.getAttribute("aria-pressed")).toBe("false");
  });

  it("restores the chosen mark from the real draft after remount", () => {
    const view = render(<SetInput {...props} onOfflineRecord={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Полуотказ" }));
    view.unmount();
    render(<SetInput {...props} onOfflineRecord={() => undefined} />);
    expect(screen.getByRole("button", { name: "Полуотказ" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("queues the selected effort against the original exercise and resets it only after persistence", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const onOfflineRecord = vi.fn();
    render(<SetInput {...props} onOfflineRecord={onOfflineRecord} />);
    fireEvent.click(screen.getByRole("button", { name: "Отказ" }));
    fireEvent.submit(screen.getByRole("button", { name: "Завершить подход 2" }).closest("form")!);
    await waitFor(() => expect(onOfflineRecord).toHaveBeenCalledWith(expect.objectContaining({ workoutExerciseId: "original-row", effort: "failure" })));
    expect(storage.queue[0].payload).toMatchObject({ workoutExerciseId: "original-row", effort: "failure" });
    expect(screen.getByRole("button", { name: "Отказ" }).getAttribute("aria-pressed")).toBe("false");
  });
});
