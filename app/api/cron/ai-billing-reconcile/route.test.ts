import { beforeEach, describe, expect, it, vi } from "vitest";

const releaseStaleAiCapacity = vi.fn();
const listStaleAiBillingOperations = vi.fn();
const failAndRefundAiBillingOperation = vi.fn();

vi.mock("@/lib/ai/guard", () => ({ releaseStaleAiCapacity }));
vi.mock("@/lib/repos/ai-billing.repo", () => ({
  listStaleAiBillingOperations,
  failAndRefundAiBillingOperation,
}));

const { POST } = await import("./route");

describe("POST /api/cron/ai-billing-reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "0123456789abcdef");
    releaseStaleAiCapacity.mockResolvedValue(2);
    listStaleAiBillingOperations.mockResolvedValue([{ id: "billing-1" }]);
    failAndRefundAiBillingOperation.mockResolvedValue(true);
  });

  it("releases stale capacity and reconciles billing with one cutoff", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/ai-billing-reconcile", {
        method: "POST",
        headers: { Authorization: "Bearer 0123456789abcdef" },
      }),
    );

    expect(response.status).toBe(200);
    expect(releaseStaleAiCapacity).toHaveBeenCalledTimes(1);
    expect(listStaleAiBillingOperations).toHaveBeenCalledWith(
      releaseStaleAiCapacity.mock.calls[0]?.[0],
    );
    await expect(response.json()).resolves.toEqual({
      checked: 1,
      refunded: 1,
      releasedCapacity: 2,
    });
  });

  it("rejects an invalid cron secret before mutating state", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/ai-billing-reconcile", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
    );

    expect(response.status).toBe(401);
    expect(releaseStaleAiCapacity).not.toHaveBeenCalled();
  });
});
