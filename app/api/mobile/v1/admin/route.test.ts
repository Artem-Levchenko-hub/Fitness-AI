import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  isUserAdmin: vi.fn(),
  listUsersOverview: vi.fn(),
  listRecentPayments: vi.fn(),
  getBillingReadiness: vi.fn(),
  getFriendProfile: vi.fn(),
  listRecentWorkouts: vi.fn(),
  listWorkoutScores: vi.fn(),
  listTemplates: vi.fn(),
  listCircuitTemplates: vi.fn(),
  listCardioTemplates: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/admin.repo", () => mocks);
vi.mock("@/lib/billing/readiness", () => ({ getBillingReadiness: mocks.getBillingReadiness }));
vi.mock("@/lib/repos/friends.repo", () => ({ getFriendProfile: mocks.getFriendProfile }));
vi.mock("@/lib/repos/workouts.repo", () => mocks);
vi.mock("@/lib/repos/templates.repo", () => ({ listTemplates: mocks.listTemplates }));
vi.mock("@/lib/repos/circuit-templates.repo", () => ({ listCircuitTemplates: mocks.listCircuitTemplates }));
vi.mock("@/lib/repos/cardio-templates.repo", () => ({ listCardioTemplates: mocks.listCardioTemplates }));

import { GET as overview } from "./route";
import { GET as userDetail } from "./users/[id]/route";

const adminId = "owner-1";
const targetId = "athlete-1";
const createdAt = new Date("2026-11-01T12:00:00Z");
const lastActivityAt = new Date("2026-11-14T09:00:00Z");
const athlete = {
  id: targetId,
  name: "Аня",
  email: "athlete@example.org",
  createdAt,
  lastActivityAt,
  strengthCount: 2,
  circuitCount: 1,
  cardioCount: 3,
  balanceKopecks: 14000,
  totalPurchasedKopecks: 20000,
  totalSpentKopecks: 6000,
  tier: "free",
};
const payment = {
  id: "payment-1",
  userEmail: athlete.email,
  kind: "topup",
  amountKopecks: 20000,
  status: "succeeded",
  providerPaymentId: "provider-reference",
  createdAt,
  refundedAt: null,
};
const billing = {
  mode: "test",
  paymentsEnabled: true,
  subscriptionsEnabled: false,
  recurringPaymentsEnabled: false,
  paymentMissing: [],
  subscriptionMissing: ["SUBSCRIPTION_ENABLED"],
};

function detail() {
  return userDetail(
    new Request(`https://fitnesss.online/api/mobile/v1/admin/users/${targetId}`),
    { params: Promise.resolve({ id: targetId }) },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: adminId, email: "owner@example.org", name: null, image: null });
  mocks.isUserAdmin.mockResolvedValue(true);
  mocks.listUsersOverview.mockResolvedValue([]);
  mocks.listRecentPayments.mockResolvedValue([]);
  mocks.getBillingReadiness.mockReturnValue(billing);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mobile admin reads", () => {
  it("requires a session before checking the role or accessing admin data", async () => {
    mocks.getUser.mockResolvedValue(null);

    for (const response of await Promise.all([overview(), detail()])) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "sign_in_required" });
    }

    expect(mocks.isUserAdmin).not.toHaveBeenCalled();
    expect(mocks.listUsersOverview).not.toHaveBeenCalled();
    expect(mocks.listRecentPayments).not.toHaveBeenCalled();
    expect(mocks.getFriendProfile).not.toHaveBeenCalled();
  });

  it("hides both reads from an authenticated non-admin, including friend data", async () => {
    mocks.isUserAdmin.mockResolvedValue(false);

    for (const response of await Promise.all([overview(), detail()])) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ error: "not_found" });
    }

    expect(mocks.isUserAdmin).toHaveBeenCalledWith(adminId);
    expect(mocks.listUsersOverview).not.toHaveBeenCalled();
    expect(mocks.listRecentPayments).not.toHaveBeenCalled();
    expect(mocks.getBillingReadiness).not.toHaveBeenCalled();
    expect(mocks.getFriendProfile).not.toHaveBeenCalled();
  });

  it("returns owner totals, account activity and payment status without the provider identifier", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    mocks.listUsersOverview.mockResolvedValue([
      athlete,
      {
        ...athlete,
        id: "athlete-2",
        name: null,
        email: "early@example.org",
        lastActivityAt: createdAt,
        totalPurchasedKopecks: 13000,
        totalSpentKopecks: 1000,
      },
    ]);
    mocks.listRecentPayments.mockResolvedValue([
      payment,
      { ...payment, id: "payment-2", kind: "subscription_initial" },
      { ...payment, id: "payment-3", providerPaymentId: null },
      { ...payment, id: "payment-4", status: "refund_pending" },
    ]);

    const response = await overview();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.summary).toEqual({ userCount: 2, active7d: 1, totalPurchasedKopecks: 33000, totalSpentKopecks: 7000 });
    expect(body.billing).toEqual(billing);
    expect(body.users[0]).toEqual({
      ...athlete,
      createdAt: createdAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
    });
    expect(body.payments).toMatchObject([
      { id: "payment-1", status: "succeeded", canRequestRefund: true },
      { id: "payment-2", status: "succeeded", canRequestRefund: false },
      { id: "payment-3", status: "succeeded", canRequestRefund: false },
      { id: "payment-4", status: "refund_pending", canRequestRefund: false },
    ]);
    expect(body.payments[0]).not.toHaveProperty("providerPaymentId");
    expect(mocks.listUsersOverview).toHaveBeenCalledWith(adminId);
    expect(mocks.listRecentPayments).toHaveBeenCalledWith(adminId);
  });

  it("returns recent completed strength activity and read-only template metadata via the friend profile", async () => {
    const profile = { id: targetId, name: athlete.name, email: athlete.email, heightCm: 169, weightKg: 61.5, sharesPrograms: true };
    const workout = {
      id: "workout-1", name: "Ноги", status: "completed", startedAt: lastActivityAt,
      finishedAt: new Date("2026-11-14T09:42:00Z"), setCount: 8, tonnageKg: 3500, hasAnalysis: true,
    };
    mocks.getFriendProfile.mockResolvedValue(profile);
    mocks.listRecentWorkouts.mockResolvedValue([workout, { ...workout, id: "workout-2", status: "active" }]);
    mocks.listWorkoutScores.mockResolvedValue(new Map([[workout.id, 92]]));
    mocks.listTemplates.mockResolvedValue([
      { id: "template-1", name: "День ног", description: null, exerciseCount: 3, updatedAt: lastActivityAt },
    ]);
    mocks.listCircuitTemplates.mockResolvedValue([]);
    mocks.listCardioTemplates.mockResolvedValue([]);

    const response = await detail();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      profile: { id: targetId, name: "Аня", email: athlete.email, heightCm: 169, weightKg: 61.5 },
      workouts: [{
        id: "workout-1", name: "Ноги", startedAt: lastActivityAt.toISOString(),
        finishedAt: "2026-11-14T09:42:00.000Z", setCount: 8, tonnageKg: 3500, score: 92,
      }],
      templates: [{ id: "template-1", format: "strength", name: "День ног", meta: "Силовая · 3 упражнения" }],
    });
    expect(mocks.getFriendProfile).toHaveBeenCalledWith(adminId, targetId);
    expect(mocks.listWorkoutScores).toHaveBeenCalledWith(targetId, ["workout-1"]);
  });

  it("returns a private 404 for a missing user before loading workouts or templates", async () => {
    mocks.getFriendProfile.mockResolvedValue(null);

    const response = await detail();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.listRecentWorkouts).not.toHaveBeenCalled();
    expect(mocks.listTemplates).not.toHaveBeenCalled();
  });
});
