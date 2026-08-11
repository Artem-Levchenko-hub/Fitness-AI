// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { CoachChat } from "./coach-chat";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CoachChat", () => {
  it("renders the durable conversation passed after a page refresh", () => {
    render(
      <CoachChat
        workoutId="00000000-0000-4000-8000-000000000001"
        workoutName="ФУЛЛ БОДИ"
        initialMessages={[
          { id: "user-1", role: "user", content: "Тренировка далась тяжело" },
          { id: "coach-1", role: "assistant", content: "Снизим объём" },
        ]}
      />,
    );

    expect(screen.getByText("Тренировка далась тяжело")).not.toBeNull();
    expect(screen.getByText("Снизим объём")).not.toBeNull();
    expect(screen.queryByText(/Коуч готов проанализировать/)).toBeNull();
  });

  it("sends one new durable message and renders the streamed reply", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("Ответ сохранён"));

    render(
      <CoachChat
        workoutId="00000000-0000-4000-8000-000000000001"
        workoutName="ФУЛЛ БОДИ"
        initialMessages={[]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Как скорректировать план?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить анализ" }));

    await waitFor(() =>
      expect(screen.getByText("Ответ сохранён")).not.toBeNull(),
    );
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("/api/ai/coach");
    const init = request?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      workoutId: "00000000-0000-4000-8000-000000000001",
      message: "Как скорректировать план?",
    });
    expect(body.clientMessageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(body.messages).toBeUndefined();
  });
});
