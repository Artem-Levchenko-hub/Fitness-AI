import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGemini: vi.fn(),
  createOpenAI: vi.fn(),
  geminiModel: vi.fn(),
  openaiChatModel: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mocks.createGemini,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock("@/lib/env", () => ({
  env: {
    AI_PROVIDER: "aitunnel",
    AI_API_KEY: "test-aitunnel-key",
    AI_BASE_URL: "https://api.aitunnel.ru/v1",
    AI_MODEL: "kimi-k3",
    AI_EMBED_MODEL: "text-embedding-3-small",
    GEMINI_API_KEY: "must-not-win",
    GEMINI_MODEL: "gemini-fallback",
  },
}));

import { aiClient, aiRequestProviderOptions, COACH_MODEL } from "./deepseek";

describe("AITUNNEL provider selection", () => {
  beforeEach(() => {
    mocks.createGemini.mockReset();
    mocks.createOpenAI.mockReset();
    mocks.geminiModel.mockReset();
    mocks.openaiChatModel.mockReset();
    mocks.createGemini.mockReturnValue(mocks.geminiModel);
    mocks.createOpenAI.mockReturnValue({ chat: mocks.openaiChatModel });
    mocks.openaiChatModel.mockReturnValue({ provider: "aitunnel" });
  });

  it("routes explicit AITUNNEL configuration to Kimi K3 even when Gemini is configured", () => {
    expect(COACH_MODEL).toBe("kimi-k3");

    aiClient(COACH_MODEL);

    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-aitunnel-key",
        baseURL: "https://api.aitunnel.ru/v1",
      }),
    );
    expect(mocks.openaiChatModel).toHaveBeenCalledWith("kimi-k3");
    expect(mocks.createGemini).not.toHaveBeenCalled();
  });

  it("attributes AITUNNEL spend to an opaque application user id", () => {
    expect(aiRequestProviderOptions("user-42")).toEqual({
      openai: { user: "user-42" },
    });
  });
});
