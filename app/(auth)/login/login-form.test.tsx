// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithEmail: vi.fn(),
}));

vi.mock("@/server/actions/auth", () => ({
  signInWithEmail: mocks.signInWithEmail,
}));

import { CodeStep, LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("submits an OTP only once while the browser is opening the next page", () => {
  render(
    <CodeStep
      email="user@example.test"
      callbackUrl="/dashboard"
      onBack={vi.fn()}
      onResend={vi.fn()}
    />,
  );
  const input = screen.getByRole<HTMLInputElement>("textbox", {
    name: "Код из письма",
  });
  fireEvent.change(input, { target: { value: "123456" } });
  const form = input.form!;

  expect(fireEvent.submit(form)).toBe(true);
  expect(fireEvent.submit(form)).toBe(false);
  expect(new FormData(form).get("token")).toBe("123456");
  const submit = screen.getByRole<HTMLButtonElement>("button", { name: "Входим…" });
  expect(submit.disabled).toBe(true);
});

it("offers a new code after verification fails", () => {
  render(<LoginForm verificationFailed />);

  expect(screen.getByRole("alert").textContent).toContain("Запросите новый код");
  const submit = screen.getByRole<HTMLButtonElement>("button", {
    name: "Получить код на email",
  });
  expect(submit.disabled).toBe(false);
});

describe("CodeStep resend", () => {
  it("показывает ошибку вместо ложного сообщения об отправке", async () => {
    const onResend = vi.fn().mockResolvedValue({
      status: "error",
      message: "Не удалось отправить код. Попробуйте позже.",
    });

    render(
      <CodeStep
        email="user@example.test"
        callbackUrl="/dashboard"
        onBack={vi.fn()}
        onResend={onResend}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Не получили код? Отправить заново" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Не удалось отправить код. Попробуйте позже.",
    );
    expect(screen.queryByText("Новый код отправлен")).toBeNull();
  });

  it("подтверждает только успешную повторную отправку", async () => {
    const onResend = vi.fn().mockResolvedValue({
      status: "sent",
      email: "user@example.test",
      callbackUrl: "/dashboard",
    });

    render(
      <CodeStep
        email="user@example.test"
        callbackUrl="/dashboard"
        onBack={vi.fn()}
        onResend={onResend}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Не получили код? Отправить заново" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Новый код отправлен")).not.toBeNull(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("разблокирует ввод email после сетевой ошибки повторной отправки", async () => {
    mocks.signInWithEmail
      .mockResolvedValueOnce({
        status: "sent",
        email: "user@example.test",
        callbackUrl: "/dashboard",
      })
      .mockRejectedValueOnce(new Error("network unavailable"));

    render(<LoginForm callbackUrl="/dashboard" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "user@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Получить код на email" }));

    await screen.findByRole("heading", { name: "Проверьте почту" });
    fireEvent.click(
      screen.getByRole("button", { name: "Не получили код? Отправить заново" }),
    );
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Изменить email" }));

    const emailInput = screen.getByRole("textbox", { name: "Email" });
    const submit = screen.getByRole("button", { name: "Получить код на email" });
    expect((emailInput as HTMLInputElement).disabled).toBe(false);
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });
});
