export type ExpectedYooPayment = Readonly<{
  providerPaymentId: string;
  amountKopecks: number;
  internalId: string;
  userId: string;
  /** `true` in a YooKassa test shop, `false` for live payments. */
  test: boolean;
}>;

export type YooPaymentVerificationFailureReason =
  | "malformed_payload"
  | "payment_id_mismatch"
  | "status_not_succeeded"
  | "payment_not_paid"
  | "currency_mismatch"
  | "invalid_amount"
  | "amount_mismatch"
  | "internal_id_mismatch"
  | "user_id_mismatch"
  | "mode_mismatch";

export type YooPaymentVerificationResult =
  | Readonly<{
      ok: true;
      paymentId: string;
      amountKopecks: number;
      metadata: Readonly<{
        internalId: string;
        userId: string;
      }>;
      test: boolean;
    }>
  | Readonly<{
      ok: false;
      reason: YooPaymentVerificationFailureReason;
    }>;

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Parses YooKassa's canonical decimal RUB representation (`"1290.00"`) into
 * integer kopecks. BigInt is used for the decimal shift, so no floating-point
 * value participates in payment verification.
 */
export function parseYooRubAmountToKopecks(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const kopecks = BigInt(match[1]) * BigInt(100) + BigInt(match[2]);
  if (kopecks > MAX_SAFE_INTEGER_BIGINT) {
    return null;
  }
  return Number(kopecks);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExpectedPayment(expected: ExpectedYooPayment): void {
  if (typeof expected.test !== "boolean") {
    throw new TypeError("Expected test mode must be an explicit boolean");
  }
  if (
    !Number.isSafeInteger(expected.amountKopecks) ||
    expected.amountKopecks < 0
  ) {
    throw new TypeError("Expected amount must be non-negative integer kopecks");
  }
  for (const [name, value] of [
    ["provider payment id", expected.providerPaymentId],
    ["internal id", expected.internalId],
    ["user id", expected.userId],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`Expected ${name} must be a non-empty string`);
    }
  }
}

/**
 * Verifies all trusted fields after fetching a payment directly from YooKassa.
 * A webhook or redirect payload must not be accepted without this check.
 */
export function verifyYooPayment(
  payment: unknown,
  expected: ExpectedYooPayment,
): YooPaymentVerificationResult {
  assertExpectedPayment(expected);

  if (!isRecord(payment)) {
    return { ok: false, reason: "malformed_payload" };
  }
  if (
    typeof payment.id !== "string" ||
    payment.id !== expected.providerPaymentId
  ) {
    return { ok: false, reason: "payment_id_mismatch" };
  }
  if (payment.status !== "succeeded") {
    return { ok: false, reason: "status_not_succeeded" };
  }
  if (payment.paid !== true) {
    return { ok: false, reason: "payment_not_paid" };
  }
  if (!isRecord(payment.amount)) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (payment.amount.currency !== "RUB") {
    return { ok: false, reason: "currency_mismatch" };
  }

  const amountKopecks = parseYooRubAmountToKopecks(payment.amount.value);
  if (amountKopecks === null) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (amountKopecks !== expected.amountKopecks) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (!isRecord(payment.metadata)) {
    return { ok: false, reason: "malformed_payload" };
  }
  if (payment.metadata.internalId !== expected.internalId) {
    return { ok: false, reason: "internal_id_mismatch" };
  }
  if (payment.metadata.userId !== expected.userId) {
    return { ok: false, reason: "user_id_mismatch" };
  }
  if (payment.test !== expected.test) {
    return { ok: false, reason: "mode_mismatch" };
  }

  return {
    ok: true,
    paymentId: payment.id,
    amountKopecks,
    metadata: {
      internalId: expected.internalId,
      userId: expected.userId,
    },
    test: expected.test,
  };
}

export type ExpectedYooRefund = Readonly<{
  providerPaymentId: string;
  amountKopecks: number;
}>;

export function verifyYooRefund(
  refund: unknown,
  expected: ExpectedYooRefund,
):
  | { ok: true; refundId: string; amountKopecks: number }
  | { ok: false; reason: string } {
  if (!isRecord(refund) || typeof refund.id !== "string" || !refund.id) {
    return { ok: false, reason: "malformed_payload" };
  }
  if (refund.payment_id !== expected.providerPaymentId) {
    return { ok: false, reason: "payment_id_mismatch" };
  }
  if (refund.status !== "succeeded") {
    return { ok: false, reason: `status_${String(refund.status)}` };
  }
  if (!isRecord(refund.amount) || refund.amount.currency !== "RUB") {
    return { ok: false, reason: "currency_mismatch" };
  }
  const amountKopecks = parseYooRubAmountToKopecks(refund.amount.value);
  if (amountKopecks === null || amountKopecks !== expected.amountKopecks) {
    return { ok: false, reason: "amount_mismatch" };
  }
  return { ok: true, refundId: refund.id, amountKopecks };
}
