import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockedEnv } = vi.hoisted(() => ({
  mockedEnv: {
    YOOKASSA_SHOP_ID: "shop-1" as string | undefined,
    YOOKASSA_SECRET_KEY: "secret-1" as string | undefined,
    YOOKASSA_VAT_CODE: 1,
    YOOKASSA_MODE: "test" as "test" | "live",
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: mockedEnv }));

import {
  createYooPayment,
  createYooRefund,
  getYooPayment,
  getYooRefund,
  isYookassaConfigured,
  isYookassaPaymentInConfiguredMode,
  isYookassaTestMode,
  YookassaApiError,
  type YooPayment,
} from "@/lib/billing/yookassa";

const payment: YooPayment = {
  id: "payment-1",
  status: "pending",
  paid: false,
  amount: { value: "123.45", currency: "RUB" },
  test: true,
  created_at: "2026-07-30T12:00:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("YooKassa REST client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockedEnv.YOOKASSA_SHOP_ID = "shop-1";
    mockedEnv.YOOKASSA_SECRET_KEY = "secret-1";
    mockedEnv.YOOKASSA_VAT_CODE = 1;
    mockedEnv.YOOKASSA_MODE = "test";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks complete configuration and payment mode", () => {
    expect(isYookassaConfigured()).toBe(true);
    expect(isYookassaTestMode()).toBe(true);
    expect(isYookassaPaymentInConfiguredMode({ test: true })).toBe(true);
    expect(isYookassaPaymentInConfiguredMode({ test: false })).toBe(false);

    mockedEnv.YOOKASSA_MODE = "live";
    expect(isYookassaTestMode()).toBe(false);
    expect(isYookassaPaymentInConfiguredMode({ test: false })).toBe(true);

    mockedEnv.YOOKASSA_SECRET_KEY = undefined;
    expect(isYookassaConfigured()).toBe(false);
  });

  it("creates redirect payment with receipt and idempotence headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse(payment));

    await expect(
      createYooPayment({
        amountKopecks: 12_345,
        description: "Персональная тренировка",
        customerEmail: "user@example.com",
        returnUrl: "https://fitness.example/billing/return",
        metadata: { internalId: "internal-1" },
        savePaymentMethod: true,
        idempotenceKey: "idem-payment-1",
      }),
    ).resolves.toEqual(payment);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.yookassa.ru/v3/payments");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from("shop-1:secret-1").toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotence-Key": "idem-payment-1",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      amount: { value: "123.45", currency: "RUB" },
      confirmation: {
        type: "redirect",
        return_url: "https://fitness.example/billing/return",
      },
      capture: true,
      description: "Персональная тренировка",
      metadata: { internalId: "internal-1" },
      save_payment_method: true,
      receipt: {
        customer: { email: "user@example.com" },
        items: [
          {
            description: "Персональная тренировка",
            quantity: "1.00",
            amount: { value: "123.45", currency: "RUB" },
            vat_code: 1,
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
    });
  });

  it("creates a payment with a saved payment_method_id without redirect", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...payment,
        payment_method: {
          id: "pm-saved-1",
          type: "bank_card",
          saved: true,
        },
      }),
    );

    await createYooPayment({
      amountKopecks: 5_000,
      description: "Подписка",
      customerEmail: "saved@example.com",
      paymentMethodId: "pm-saved-1",
      idempotenceKey: "idem-saved-1",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.payment_method_id).toBe("pm-saved-1");
    expect(body).not.toHaveProperty("confirmation");
    expect(body).not.toHaveProperty("save_payment_method");
  });

  it("gets a payment using encoded id and read timeout signal", async () => {
    fetchMock.mockResolvedValue(jsonResponse(payment));

    await expect(getYooPayment("payment/with space")).resolves.toEqual(payment);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.yookassa.ru/v3/payments/payment%2Fwith%20space",
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from("shop-1:secret-1").toString("base64")}`,
        },
      }),
    );
  });

  it("creates full and partial refunds with distinct idempotence keys", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: "refund-full",
          payment_id: "payment-1",
          status: "succeeded",
          amount: { value: "123.45", currency: "RUB" },
          created_at: "2026-07-30T12:10:00Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "refund-partial",
          payment_id: "payment-1",
          status: "succeeded",
          amount: { value: "23.45", currency: "RUB" },
          created_at: "2026-07-30T12:11:00Z",
        }),
      );

    await createYooRefund({
      paymentId: "payment-1",
      amountKopecks: 12_345,
      description: "Полный возврат",
      idempotenceKey: "idem-refund-full",
    });
    await createYooRefund({
      paymentId: "payment-1",
      amountKopecks: 2_345,
      idempotenceKey: "idem-refund-partial",
    });

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(firstInit.headers).toMatchObject({
      "Idempotence-Key": "idem-refund-full",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(firstInit.body as string)).toEqual({
      payment_id: "payment-1",
      amount: { value: "123.45", currency: "RUB" },
      description: "Полный возврат",
    });
    expect(secondInit.headers).toMatchObject({
      "Idempotence-Key": "idem-refund-partial",
    });
    expect(JSON.parse(secondInit.body as string)).toEqual({
      payment_id: "payment-1",
      amount: { value: "23.45", currency: "RUB" },
    });
  });

  it("gets a refund using encoded id", async () => {
    const refund = {
      id: "refund/1",
      payment_id: "payment-1",
      status: "succeeded" as const,
      amount: { value: "123.45", currency: "RUB" as const },
      created_at: "2026-07-30T12:10:00Z",
    };
    fetchMock.mockResolvedValue(jsonResponse(refund));

    await expect(getYooRefund("refund/1")).resolves.toEqual(refund);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.yookassa.ru/v3/refunds/refund%2F1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("does not expose provider response body or network error details", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("provider-secret-card-data", { status: 400 }),
    );

    const providerError = await createYooRefund({
      paymentId: "payment-1",
      amountKopecks: 100,
      idempotenceKey: "idem-error-1",
    }).catch((error: unknown) => error);

    expect(providerError).toBeInstanceOf(YookassaApiError);
    expect(providerError).toMatchObject({
      operation: "createRefund",
      status: 400,
    });
    expect((providerError as Error).message).not.toContain(
      "provider-secret-card-data",
    );

    fetchMock.mockRejectedValueOnce(new Error("socket contained a secret"));
    const networkError = await getYooPayment("payment-1").catch(
      (error: unknown) => error,
    );
    expect(networkError).toBeInstanceOf(YookassaApiError);
    expect((networkError as Error).message).not.toContain(
      "socket contained a secret",
    );
  });
});
