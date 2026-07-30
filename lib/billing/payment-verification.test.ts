import { describe, expect, it } from "vitest";

import {
  parseYooRubAmountToKopecks,
  verifyYooPayment,
  verifyYooRefund,
  type ExpectedYooPayment,
} from "./payment-verification";

const EXPECTED: ExpectedYooPayment = {
  providerPaymentId: "2f0f67f0-000f-5000-8000-1d5d7b764ead",
  amountKopecks: 129_000,
  internalId: "payment_internal_42",
  userId: "user_17",
  test: false,
};

function validPayment(): unknown {
  return {
    id: EXPECTED.providerPaymentId,
    status: "succeeded",
    paid: true,
    amount: {
      value: "1290.00",
      currency: "RUB",
    },
    metadata: {
      internalId: EXPECTED.internalId,
      userId: EXPECTED.userId,
    },
    test: EXPECTED.test,
  };
}

describe("parseYooRubAmountToKopecks", () => {
  it("parses YooKassa decimal RUB strings without floating-point arithmetic", () => {
    expect(parseYooRubAmountToKopecks("0.00")).toBe(0);
    expect(parseYooRubAmountToKopecks("1290.00")).toBe(129_000);
    expect(parseYooRubAmountToKopecks("13900.00")).toBe(1_390_000);
    expect(parseYooRubAmountToKopecks("90071992547409.91")).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("rejects non-canonical, negative, unsafe or non-string values", () => {
    for (const value of [
      "1290",
      "1290.0",
      "1290.000",
      "7e2",
      " 1290.00",
      "+1290.00",
      "-1.00",
      "01.00",
      "90071992547409.92",
      "",
      1290,
      null,
    ]) {
      expect(parseYooRubAmountToKopecks(value)).toBeNull();
    }
  });
});

describe("verifyYooRefund", () => {
  const refund = {
    id: "refund-1",
    payment_id: "payment-1",
    status: "succeeded",
    amount: { value: "330.00", currency: "RUB" },
  };

  it("принимает точный successful RUB refund", () => {
    expect(
      verifyYooRefund(refund, {
        providerPaymentId: "payment-1",
        amountKopecks: 33_000,
      }),
    ).toEqual({
      ok: true,
      refundId: "refund-1",
      amountKopecks: 33_000,
    });
  });

  it("отклоняет чужой payment, сумму и pending", () => {
    expect(
      verifyYooRefund(
        { ...refund, payment_id: "other" },
        { providerPaymentId: "payment-1", amountKopecks: 33_000 },
      ),
    ).toEqual({ ok: false, reason: "payment_id_mismatch" });
    expect(
      verifyYooRefund(
        { ...refund, amount: { value: "329.00", currency: "RUB" } },
        { providerPaymentId: "payment-1", amountKopecks: 33_000 },
      ),
    ).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(
      verifyYooRefund(
        { ...refund, status: "pending" },
        { providerPaymentId: "payment-1", amountKopecks: 33_000 },
      ),
    ).toEqual({ ok: false, reason: "status_pending" });
  });
});

describe("verifyYooPayment", () => {
  it("accepts a succeeded, paid, exact RUB payment for the expected owner and mode", () => {
    expect(verifyYooPayment(validPayment(), EXPECTED)).toEqual({
      ok: true,
      paymentId: EXPECTED.providerPaymentId,
      amountKopecks: EXPECTED.amountKopecks,
      metadata: {
        internalId: EXPECTED.internalId,
        userId: EXPECTED.userId,
      },
      test: EXPECTED.test,
    });
  });

  it.each([
    ["payment_id_mismatch", { id: "another-payment" }],
    ["status_not_succeeded", { status: "pending" }],
    ["payment_not_paid", { paid: false }],
    ["currency_mismatch", { amount: { value: "1290.00", currency: "USD" } }],
    ["invalid_amount", { amount: { value: "1290", currency: "RUB" } }],
    ["amount_mismatch", { amount: { value: "1290.01", currency: "RUB" } }],
    [
      "internal_id_mismatch",
      {
        metadata: {
          internalId: "another-internal-id",
          userId: EXPECTED.userId,
        },
      },
    ],
    [
      "user_id_mismatch",
      {
        metadata: {
          internalId: EXPECTED.internalId,
          userId: "another-user",
        },
      },
    ],
    ["mode_mismatch", { test: true }],
  ] as const)("rejects with %s", (reason, patch) => {
    const payment = {
      ...(validPayment() as Record<string, unknown>),
      ...patch,
    };

    expect(verifyYooPayment(payment, EXPECTED)).toEqual({ ok: false, reason });
  });

  it("rejects malformed provider payloads instead of throwing", () => {
    for (const payload of [
      null,
      [],
      {},
      { ...(validPayment() as Record<string, unknown>), amount: null },
      { ...(validPayment() as Record<string, unknown>), metadata: null },
    ]) {
      expect(verifyYooPayment(payload, EXPECTED).ok).toBe(false);
    }
  });

  it("requires an explicit expected test/live mode", () => {
    expect(() =>
      verifyYooPayment(validPayment(), {
        ...EXPECTED,
        test: undefined as never,
      }),
    ).toThrow(/expected test mode/i);
  });
});
