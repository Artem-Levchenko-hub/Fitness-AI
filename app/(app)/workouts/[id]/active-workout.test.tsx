// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveWorkout, ActiveWorkoutExercise } from "@/lib/repos/workouts.repo";
import type { OutboxMutation } from "@/lib/storage/outbox";

const storage = vi.hoisted(() => ({ queue: [] as OutboxMutation[] }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const actions = vi.hoisted(() => ({
  addWorkoutExerciseAction: vi.fn().mockResolvedValue({ status: "success" }),
  removeWorkoutExerciseAction: vi.fn().mockResolvedValue({ status: "success" }),
  replaceWorkoutExerciseAction: vi.fn().mockResolvedValue({ status: "success" }),
  recordSetAction: vi.fn().mockResolvedValue({ status: "idle" }),
  deleteSetAction: vi.fn(), finishWorkoutAction: vi.fn(), cancelWorkoutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/server/actions/workouts", () => actions);
vi.mock("@/lib/storage/outbox", () => ({
  listPending: async () => storage.queue,
  subscribeOutboxChanged: () => () => undefined,
  enqueue: async (mutation: OutboxMutation) => { storage.queue.push(mutation); },
  makeClientId: () => "client-set",
}));

import { ActiveWorkoutView } from "./active-workout";

const exercises = [
  { id: "bench", nameRu: "Жим лёжа", nameEn: "Bench press", isCustom: false },
  { id: "squat", nameRu: "Приседания", nameEn: "Squat", isCustom: false },
];
const exercise: ActiveWorkoutExercise = {
  id: "row-bench", exerciseId: "bench", position: 0,
  exerciseNameRu: "Жим лёжа", exerciseNameEn: "Bench press", exerciseSlug: "unknown",
  targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 40,
  targetRestSeconds: 90, myoReps: false, myoMiniSets: 3, myoMiniReps: 5,
  myoMiniRestSeconds: 20, sets: [], replacedAt: null,
};
const workout: ActiveWorkout = {
  id: "workout", name: "Тренировка", status: "active", startedAt: new Date(),
  finishedAt: null, exercises: [exercise],
};
function view(value = workout) {
  return <ActiveWorkoutView workout={value} previousByExerciseId={new Map()} goalByExerciseId={new Map()} replacementExercises={exercises} />;
}
async function openAddition() {
  fireEvent.click(screen.getByRole("button", { name: "Добавить упражнение" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Упражнение для добавления" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Поиск упражнения" }), { target: { value: "Squat" } });
  fireEvent.click(await screen.findByRole("option", { name: /Приседания/ }));
}

beforeEach(() => {
  storage.queue.length = 0;
  localStorage.clear();
  vi.clearAllMocks();
  actions.addWorkoutExerciseAction.mockResolvedValue({ status: "success" });
  actions.removeWorkoutExerciseAction.mockResolvedValue({ status: "success" });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("active workout plan controls", () => {
  it("adds a searched exercise with editable starting sets and blocks repeated submission until it finishes", { timeout: 15_000 }, async () => {
    let resolve!: (value: { status: string }) => void;
    actions.addWorkoutExerciseAction.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(view());
    await openAddition();
    const sets = screen.getByRole("textbox", { name: "Подходы" });
    expect((sets as HTMLInputElement).value).toBe("3");
    fireEvent.change(sets, { target: { value: "4" } });
    const submit = screen.getByRole("button", { name: "Добавить в тренировку" });
    fireEvent.click(submit);
    fireEvent.submit(submit.closest("form")!);
    await waitFor(() => expect(actions.addWorkoutExerciseAction).toHaveBeenCalledTimes(1));
    const payload = actions.addWorkoutExerciseAction.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(payload.entries())).toEqual({ workoutId: "workout", exerciseId: "squat", targetSets: "4" });
    expect((screen.getByRole("button", { name: "Завершить тренировку" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve({ status: "success" }); });
    expect(screen.queryByRole("button", { name: "Добавить в тренировку" })).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps an add failure visible with the user's selection and rejects zero starting sets", async () => {
    actions.addWorkoutExerciseAction.mockResolvedValue({ status: "error", message: "Тренировка уже завершена" });
    render(view());
    await openAddition();
    const sets = screen.getByRole("textbox", { name: "Подходы" });
    fireEvent.change(sets, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить в тренировку" }));
    expect(actions.addWorkoutExerciseAction).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("от 1 до 20"));
    fireEvent.change(sets, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить в тренировку" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Тренировка уже завершена");
    expect((sets as HTMLInputElement).value).toBe("2");
    expect(screen.getByRole("combobox", { name: "Упражнение для добавления" }).textContent).toContain("Приседания");
  });

  it("confirms removing a completed last exercise and keeps its recorded set and effort after refresh", async () => {
    const done = { ...exercise, targetSets: 1, sets: [{ id: "set", setIndex: 0, setType: "working" as const,
      weightKg: 40, reps: 12, effort: "failure" as const, rpe: null, restSeconds: 90,
      completedAt: new Date(), savedAt: new Date() }] };
    const rendered = render(view({ ...workout, exercises: [done] }));
    fireEvent.click(screen.getByRole("button", { name: "Убрать из плана" }));
    const dialog = screen.getByRole("dialog", { name: "Убрать упражнение из плана?" });
    expect(dialog.textContent).toContain("Записанные подходы сохранятся");
    expect(actions.removeWorkoutExerciseAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Убрать из плана" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(Object.fromEntries((actions.removeWorkoutExerciseAction.mock.calls[0][0] as FormData).entries()))
      .toEqual({ workoutId: "workout", workoutExerciseId: "row-bench" });
    rendered.rerender(view({ ...workout, exercises: [{ ...done, replacedAt: new Date() }] }));
    expect(screen.getByText("40 кг × 12")).toBeTruthy();
    expect(screen.getByText("Отказ")).toBeTruthy();
    expect(screen.getByText(/Убрано из плана/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Убрать из плана" })).toBeNull();
    expect(screen.getByText("0 из 0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Добавить упражнение" })).toBeTruthy();
  });

  it("rechecks queued sets before removing and displays the failure in the confirmation", async () => {
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "Убрать из плана" }));
    storage.queue.push({ clientId: "queued", kind: "recordSet", payload: { workoutId: "workout", workoutExerciseId: "row-bench" }, queuedAt: 1 });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Убрать из плана" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("синхронизации");
    expect(actions.removeWorkoutExerciseAction).not.toHaveBeenCalled();
  });

  it("blocks new plan changes when a finish appears after the add picker opened", async () => {
    render(view());
    await openAddition();
    storage.queue.push({ clientId: "finish:workout", kind: "finishWorkout", payload: { workoutId: "workout" }, queuedAt: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Добавить в тренировку" }));
    expect((await screen.findByRole("alert")).textContent).toContain("завершения");
    expect(actions.addWorkoutExerciseAction).not.toHaveBeenCalled();
  });

  it("disables plan controls offline while retaining offline set entry", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(view());
    expect((screen.getByRole("button", { name: "Добавить упражнение" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Убрать из плана" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Завершить подход 1" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
