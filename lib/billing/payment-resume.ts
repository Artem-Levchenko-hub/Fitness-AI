type PaymentMode = "one_time" | "recurring";

type ResumablePayment = {
  amountKopecks: number;
  metadata: unknown;
  planCode: string | null;
};

const TRUSTED_CHECKOUT_HOSTS = ["yookassa.ru", "yoomoney.ru"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getStoredPaymentMode(metadata: Record<string, unknown>): unknown {
  if ("paymentMode" in metadata) return metadata.paymentMode;
  return asRecord(metadata.metadata)?.paymentMode;
}

function isTrustedCheckoutHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return TRUSTED_CHECKOUT_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

/**
 * Возвращает сохранённый redirect только для того же тарифа и режима оплаты.
 * Provider payload хранится в БД как untrusted JSON, поэтому URL ограничен
 * HTTPS-доменами ЮKassa/ЮMoney и никогда не берётся из клиентского запроса.
 */
export function getResumableYookassaConfirmationUrl(
  payment: ResumablePayment,
  requested: {
    amountKopecks: number;
    planCode: string;
    paymentMode: PaymentMode;
  },
): string | null {
  if (
    payment.planCode !== requested.planCode ||
    payment.amountKopecks !== requested.amountKopecks
  ) {
    return null;
  }

  const metadata = asRecord(payment.metadata);
  if (!metadata || getStoredPaymentMode(metadata) !== requested.paymentMode) {
    return null;
  }

  const confirmation = asRecord(metadata.confirmation);
  const rawUrl = confirmation?.confirmation_url;
  if (typeof rawUrl !== "string") return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !isTrustedCheckoutHost(url.hostname)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
