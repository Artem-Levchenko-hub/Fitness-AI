import { describe, expect, it } from "vitest";

import { getResumableYookassaConfirmationUrl } from "./payment-resume";

const checkoutUrl =
  "https://yoomoney.ru/checkout/payments/v2/contract?orderId=safe";

describe("getResumableYookassaConfirmationUrl", () => {
  it("возвращает checkout того же тарифа и режима", () => {
    expect(
      getResumableYookassaConfirmationUrl(
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          metadata: {
            confirmation: { confirmation_url: checkoutUrl },
            metadata: { paymentMode: "one_time" },
          },
        },
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          paymentMode: "one_time",
        },
      ),
    ).toBe(checkoutUrl);
  });

  it("поддерживает metadata до attach provider payment", () => {
    expect(
      getResumableYookassaConfirmationUrl(
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          metadata: {
            paymentMode: "one_time",
            confirmation: { confirmation_url: checkoutUrl },
          },
        },
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          paymentMode: "one_time",
        },
      ),
    ).toBe(checkoutUrl);
  });

  it("не возобновляет другой тариф или режим оплаты", () => {
    const payment = {
      amountKopecks: 29_000,
      planCode: "pro_monthly",
      metadata: {
        confirmation: { confirmation_url: checkoutUrl },
        metadata: { paymentMode: "one_time" },
      },
    };

    expect(
      getResumableYookassaConfirmationUrl(payment, {
        amountKopecks: 29_000,
        planCode: "pro_yearly",
        paymentMode: "one_time",
      }),
    ).toBeNull();
    expect(
      getResumableYookassaConfirmationUrl(payment, {
        amountKopecks: 29_000,
        planCode: "pro_monthly",
        paymentMode: "recurring",
      }),
    ).toBeNull();
    expect(
      getResumableYookassaConfirmationUrl(payment, {
        amountKopecks: 19_000,
        planCode: "pro_monthly",
        paymentMode: "one_time",
      }),
    ).toBeNull();
  });

  it("отклоняет HTTP и посторонние redirect-домены", () => {
    for (const unsafeUrl of [
      "http://yoomoney.ru/checkout",
      "https://yoomoney.ru.evil.example/checkout",
      "https://example.com/checkout",
      "not-a-url",
    ]) {
      expect(
        getResumableYookassaConfirmationUrl(
          {
            amountKopecks: 29_000,
            planCode: "pro_monthly",
            metadata: {
              confirmation: { confirmation_url: unsafeUrl },
              metadata: { paymentMode: "one_time" },
            },
          },
          {
            amountKopecks: 29_000,
            planCode: "pro_monthly",
            paymentMode: "one_time",
          },
        ),
      ).toBeNull();
    }
  });

  it("принимает доверенный поддомен ЮKassa", () => {
    const url = "https://payments.yookassa.ru/checkout/safe";
    expect(
      getResumableYookassaConfirmationUrl(
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          metadata: {
            confirmation: { confirmation_url: url },
            metadata: { paymentMode: "recurring" },
          },
        },
        {
          amountKopecks: 29_000,
          planCode: "pro_monthly",
          paymentMode: "recurring",
        },
      ),
    ).toBe(url);
  });
});
