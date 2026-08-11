// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import type { AiQuotaOverview } from "@/lib/billing/ai-quota-policy";

const fetchMock = vi.fn();

const baseOverview: AiQuotaOverview = {
  bucketStart: "2026-08-01T00:00:00.000Z",
  limits: {
    postWorkoutAnalyses: 15,
    coachReplies: 60,
    progressSummaries: 20,
    oneShotAiOperations: 10,
  },
  used: {
    postWorkoutAnalyses: 0,
    coachReplies: 0,
    progressSummaries: 0,
    oneShotAiOperations: 0,
  },
  remaining: {
    postWorkoutAnalyses: 15,
    coachReplies: 60,
    progressSummaries: 20,
    oneShotAiOperations: 10,
  },
  exchange: {
    completed: false,
    available: true,
    coachRepliesSpent: 20,
    postWorkoutAnalysesAdded: 10,
  },
};

describe("SubscriptionCard AI quotas", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows separate balances and confirms the monthly exchange", async () => {
    const exchanged: AiQuotaOverview = {
      ...baseOverview,
      limits: { ...baseOverview.limits, postWorkoutAnalyses: 25, coachReplies: 40 },
      remaining: {
        ...baseOverview.remaining,
        postWorkoutAnalyses: 25,
        coachReplies: 40,
      },
      exchange: { ...baseOverview.exchange, completed: true, available: false },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, exchanged: true, overview: exchanged }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <SubscriptionCard
        plans={[]}
        subscription={{
          planCode: "pro_monthly",
          status: "active",
          currentPeriodEnd: "2099-09-01T00:00:00.000Z",
          cancelAtPeriodEnd: true,
          renewalAvailable: false,
        }}
        enabled
        recurringEnabled={false}
        mode="live"
        initialQuotaOverview={baseOverview}
      />,
    );

    expect(screen.getByText("Осталось 15 из 15")).toBeTruthy();
    expect(screen.getByText("Осталось 60 из 60")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Обменять 20 вопросов на 10 разборов",
      }),
    );
    expect(screen.getByText(/обмен необратим до следующего месяца/i)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Подтвердить обмен" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/billing/quota-exchange", {
        method: "POST",
      });
      expect(screen.getByText(/обмен выполнен/i)).toBeTruthy();
    });
    expect(screen.getByText("Осталось 25 из 25")).toBeTruthy();
    expect(screen.getByText("Осталось 40 из 40")).toBeTruthy();
  });
});
