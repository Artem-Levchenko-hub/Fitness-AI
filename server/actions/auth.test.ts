import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));

import { signInWithEmail } from "./auth";

function form() {
  const data = new FormData();
  data.set("email", "user@example.test");
  data.set("callbackUrl", "/dashboard");
  return data;
}

describe("signInWithEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("возвращает sent только после успешного вызова провайдера", async () => {
    mocks.signIn.mockResolvedValue(undefined);

    await expect(
      signInWithEmail({ status: "idle" }, form()),
    ).resolves.toEqual({
      status: "sent",
      email: "user@example.test",
      callbackUrl: "/dashboard",
    });
  });

  it("превращает любую provider-ошибку в безопасный статус, а не 500", async () => {
    mocks.signIn.mockRejectedValue(new Error("provider validation body"));

    await expect(
      signInWithEmail({ status: "idle" }, form()),
    ).resolves.toEqual({
      status: "error",
      message: "Не удалось отправить код. Попробуйте позже.",
    });
  });

  it("не передаёт внешний callbackUrl в Auth.js", async () => {
    const data = form();
    data.set("callbackUrl", "https://attacker.example/steal");
    mocks.signIn.mockResolvedValue(undefined);

    await expect(signInWithEmail({ status: "idle" }, data)).resolves.toMatchObject({
      status: "sent",
      callbackUrl: "/dashboard",
    });
    expect(mocks.signIn).toHaveBeenCalledWith(
      "resend",
      expect.objectContaining({ redirectTo: "/dashboard" }),
    );
  });

  it("отклоняет non-ASCII email до отправки OTP", async () => {
    const data = form();
    data.set("email", "юзер@example.test");

    await expect(signInWithEmail({ status: "idle" }, data)).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
