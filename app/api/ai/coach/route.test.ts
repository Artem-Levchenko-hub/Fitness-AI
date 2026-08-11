import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appendCoachMessage: vi.fn(),
  listCoachMessages: vi.fn(),
  requireOwnedWorkout: vi.fn(),
  claimAiCapacity: vi.fn(),
  settleAiCapacity: vi.fn(),
  buildTrainerContext: vi.fn(),
  retrieveRelevant: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => "stop"),
  streamText: mocks.streamText,
}));
vi.mock("@/lib/ai/context-builder", () => ({
  buildTrainerContext: mocks.buildTrainerContext,
}));
vi.mock("@/lib/ai/coach-tools", () => ({ createCoachTools: vi.fn(() => ({})) }));
vi.mock("@/lib/ai/deepseek", () => ({
  aiClient: vi.fn(() => "model"),
  COACH_MODEL: "test",
  isAiConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/ai/prompts", () => ({ COACH_SYSTEM_PROMPT: "system" }));
vi.mock("@/lib/ai/guard", () => ({
  capacityDuplicateResponse: vi.fn(() => new Response(null, { status: 409 })),
  capacityErrorResponse: vi.fn(() => new Response(null, { status: 429 })),
  claimAiCapacity: mocks.claimAiCapacity,
  requireOwnedWorkout: mocks.requireOwnedWorkout,
  settleAiCapacity: mocks.settleAiCapacity,
}));
vi.mock("@/lib/ai/rag/retrieve", () => ({
  formatRetrievedChunks: vi.fn(() => "canon"),
  retrieveRelevant: mocks.retrieveRelevant,
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/lib/billing/flags", () => ({ isBillingEnabled: vi.fn(() => false) }));
vi.mock("@/lib/billing/pricing", () => ({ aiCoachPriceKopecks: vi.fn(() => 0) }));
vi.mock("@/lib/repos/ai-billing.repo", () => ({
  claimCoachBillingOperation: vi.fn(),
  completeAiBillingOperation: vi.fn(),
  failAndRefundAiBillingOperation: vi.fn(),
}));
vi.mock("@/lib/repos/coach-conversations.repo", () => {
  class CoachMessageConflictError extends Error {}
  return {
    appendCoachMessage: mocks.appendCoachMessage,
    listCoachMessages: mocks.listCoachMessages,
    CoachMessageConflictError,
  };
});
vi.mock("@/lib/repos/subscriptions.repo", () => ({
  hasActiveProSubscription: vi.fn(),
}));

const { POST } = await import("./route");

const workoutId = "00000000-0000-4000-8000-000000000001";
const clientMessageId = "00000000-0000-4000-8000-000000000002";

describe("POST /api/ai/coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwnedWorkout.mockResolvedValue(true);
    mocks.claimAiCapacity.mockResolvedValue({ kind: "allowed", usageId: "usage-1" });
    mocks.listCoachMessages.mockResolvedValue([
      { id: clientMessageId, role: "user", content: "Вопрос" },
    ]);
    mocks.buildTrainerContext.mockResolvedValue({ prompt: "athlete" });
    mocks.retrieveRelevant.mockResolvedValue([]);
    mocks.streamText.mockReturnValue({
      consumeStream: vi.fn(),
      toTextStreamResponse: () => new Response("stream"),
    });
  });

  it("does not persist a message for another user's workout", async () => {
    mocks.requireOwnedWorkout.mockResolvedValue(false);

    const response = await POST(validRequest());

    expect(response.status).toBe(404);
    expect(mocks.appendCoachMessage).not.toHaveBeenCalled();
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it("does not persist a request rejected by capacity limits", async () => {
    mocks.claimAiCapacity.mockResolvedValue({ kind: "rate_limited" });

    const response = await POST(validRequest());

    expect(response.status).toBe(429);
    expect(mocks.appendCoachMessage).not.toHaveBeenCalled();
    expect(mocks.streamText).not.toHaveBeenCalled();
  });

  it("persists the user message and the completed assistant reply", async () => {
    const response = await POST(validRequest());

    expect(response.status).toBe(200);
    expect(mocks.appendCoachMessage).toHaveBeenNthCalledWith(1, "user-1", workoutId, {
      id: clientMessageId,
      role: "user",
      content: "Вопрос",
    });
    const config = mocks.streamText.mock.calls[0]?.[0];
    const result = mocks.streamText.mock.results[0]?.value;
    expect(config.messages).toEqual([{ role: "user", content: "Вопрос" }]);
    expect(result.consumeStream).toHaveBeenCalledTimes(1);

    await config.onFinish({ text: "Сохранённый ответ" });

    expect(mocks.appendCoachMessage).toHaveBeenNthCalledWith(
      2,
      "user-1",
      workoutId,
      expect.objectContaining({ role: "assistant", content: "Сохранённый ответ" }),
    );
    expect(mocks.settleAiCapacity).toHaveBeenCalledWith("usage-1", true);
  });
});

function validRequest() {
  return new Request("http://localhost/api/ai/coach", {
    method: "POST",
    body: JSON.stringify({ workoutId, clientMessageId, message: "Вопрос" }),
  });
}
