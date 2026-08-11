import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const exchangeAiQuota = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({ requireUser }));
vi.mock("@/lib/repos/ai-quota.repo", () => ({ exchangeAiQuota }));

const { POST } = await import("./route");

describe("POST /api/billing/quota-exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1", email: "user@example.test" });
  });

  it("uses only the authenticated user id", async () => {
    exchangeAiQuota.mockResolvedValue({
      kind: "exchanged",
      overview: { exchange: { completed: true } },
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(exchangeAiQuota).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      exchanged: true,
    });
  });

  it("is idempotent after this month's exchange", async () => {
    exchangeAiQuota.mockResolvedValue({
      kind: "already_exchanged",
      overview: { exchange: { completed: true } },
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      exchanged: false,
    });
  });

  it("rejects exchange after more than 40 questions were used", async () => {
    exchangeAiQuota.mockResolvedValue({
      kind: "insufficient_questions",
      overview: { exchange: { completed: false, available: false } },
    });

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "insufficient_questions",
    });
  });

  it("requires an active subscription", async () => {
    exchangeAiQuota.mockResolvedValue({ kind: "subscription_required" });

    const response = await POST();

    expect(response.status).toBe(403);
  });
});
