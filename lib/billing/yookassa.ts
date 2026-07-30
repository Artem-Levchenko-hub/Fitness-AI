import "server-only";

import { env } from "@/lib/env";

/** Минимальный серверный клиент ЮKassa REST API без SDK-зависимости.
 * https://yookassa.ru/developers/api */

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";
const READ_TIMEOUT_MS = 15_000;
const WRITE_TIMEOUT_MS = 20_000;

export type YookassaMode = "test" | "live";

export type YooMoney = {
  value: string;
  currency: "RUB";
};

export type YooPaymentMethod = {
  id?: string;
  type: string;
  saved: boolean;
  status?: "active" | "inactive";
  title?: string;
  card?: {
    first6?: string;
    last4: string;
    expiry_month?: string;
    expiry_year?: string;
    card_type?: string;
    issuer_country?: string;
    source?: string;
  };
};

export type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: YooMoney;
  income_amount?: YooMoney;
  description?: string;
  recipient?: {
    account_id: string;
    gateway_id: string;
  };
  payment_method?: YooPaymentMethod;
  metadata?: Record<string, string>;
  confirmation?: {
    type: string;
    confirmation_url?: string;
    return_url?: string;
  };
  refundable?: boolean;
  test: boolean;
  created_at: string;
  captured_at?: string;
  expires_at?: string;
};

export type YooRefund = {
  id: string;
  payment_id: string;
  status: "pending" | "succeeded" | "canceled";
  amount: YooMoney;
  description?: string;
  created_at: string;
  cancellation_details?: {
    party: string;
    reason: string;
  };
};

type YooPaymentRequestBase = {
  amountKopecks: number;
  description: string;
  customerEmail: string;
  metadata?: Record<string, string>;
  /** Сохранить выбранный при redirect способ оплаты для следующих списаний. */
  savePaymentMethod?: boolean;
  /** Уникальный ключ запроса, максимум 64 символа. */
  idempotenceKey: string;
};

export type YooRedirectPaymentRequest = YooPaymentRequestBase & {
  returnUrl: string;
  paymentMethodId?: never;
};

export type YooSavedPaymentRequest = YooPaymentRequestBase & {
  paymentMethodId: string;
  returnUrl?: never;
};

export type YooPaymentRequest =
  | YooRedirectPaymentRequest
  | YooSavedPaymentRequest;

export type YooRefundRequest = {
  paymentId: string;
  /** Для полного возврата передайте всю сумму платежа, для частичного — её часть. */
  amountKopecks: number;
  description?: string;
  /** Уникальный ключ запроса, максимум 64 символа. */
  idempotenceKey: string;
};

type YookassaOperation =
  | "createPayment"
  | "getPayment"
  | "createRefund"
  | "getRefund";

/**
 * Безопасная для возврата клиенту ошибка: тело ответа и тексты провайдера
 * намеренно не попадают ни в message, ни в публичные поля.
 */
export class YookassaApiError extends Error {
  readonly operation: YookassaOperation;
  readonly status?: number;

  constructor(operation: YookassaOperation, status?: number) {
    const suffix = status === undefined ? "request failed" : `failed (HTTP ${status})`;
    super(`YooKassa ${operation} ${suffix}`);
    this.name = "YookassaApiError";
    this.operation = operation;
    this.status = status;
  }
}

function authHeader(): string {
  const shopId = env.YOOKASSA_SHOP_ID;
  const secretKey = env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA credentials not configured");
  }

  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
}

export function isYookassaConfigured(): boolean {
  return (
    !!env.YOOKASSA_SHOP_ID &&
    !!env.YOOKASSA_SECRET_KEY &&
    Number.isInteger(env.YOOKASSA_VAT_CODE) &&
    env.YOOKASSA_VAT_CODE >= 1 &&
    env.YOOKASSA_VAT_CODE <= 12 &&
    (env.YOOKASSA_MODE === "test" || env.YOOKASSA_MODE === "live")
  );
}

export function isYookassaTestMode(): boolean {
  return env.YOOKASSA_MODE === "test";
}

/** Проверяет, что test-флаг объекта ЮKassa совпадает с режимом приложения. */
export function isYookassaPaymentInConfiguredMode(
  payment: Pick<YooPayment, "test">,
): boolean {
  return payment.test === isYookassaTestMode();
}

function kopecksToRubString(kopecks: number): string {
  if (!Number.isSafeInteger(kopecks) || kopecks <= 0) {
    throw new TypeError("amountKopecks must be a positive safe integer");
  }

  return (kopecks / 100).toFixed(2);
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${field} must not be empty`);
  }
  return normalized;
}

function requireIdempotenceKey(value: string): string {
  const key = requireNonEmpty(value, "idempotenceKey");
  if (key.length > 64) {
    throw new TypeError("idempotenceKey must not exceed 64 characters");
  }
  return key;
}

async function requestYookassa<T>(
  path: string,
  operation: YookassaOperation,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${YOOKASSA_API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: authHeader(),
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new YookassaApiError(operation);
  }

  if (!response.ok) {
    // Не читаем и не пробрасываем provider body: route handlers иногда
    // возвращают Error.message клиенту.
    throw new YookassaApiError(operation, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new YookassaApiError(operation, response.status);
  }
}

export async function createYooPayment(
  req: YooPaymentRequest,
): Promise<YooPayment> {
  const amount = {
    value: kopecksToRubString(req.amountKopecks),
    currency: "RUB" as const,
  };
  const description = requireNonEmpty(req.description, "description");
  const paymentMethod =
    typeof req.paymentMethodId === "string"
      ? {
          payment_method_id: requireNonEmpty(
            req.paymentMethodId,
            "paymentMethodId",
          ),
        }
      : {
          confirmation: {
            type: "redirect",
            return_url: requireNonEmpty(
              typeof req.returnUrl === "string" ? req.returnUrl : "",
              "returnUrl",
            ),
          },
        };

  const body = {
    amount,
    ...paymentMethod,
    capture: true,
    description,
    metadata: req.metadata,
    save_payment_method: req.savePaymentMethod,
    receipt: {
      customer: {
        email: requireNonEmpty(req.customerEmail, "customerEmail"),
      },
      items: [
        {
          description,
          quantity: "1.00",
          amount,
          vat_code: env.YOOKASSA_VAT_CODE,
          payment_mode: "full_payment",
          payment_subject: "service",
        },
      ],
    },
  };

  return requestYookassa<YooPayment>(
    "/payments",
    "createPayment",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": requireIdempotenceKey(req.idempotenceKey),
      },
      body: JSON.stringify(body),
    },
    WRITE_TIMEOUT_MS,
  );
}

export async function getYooPayment(paymentId: string): Promise<YooPayment> {
  const id = requireNonEmpty(paymentId, "paymentId");

  return requestYookassa<YooPayment>(
    `/payments/${encodeURIComponent(id)}`,
    "getPayment",
    { method: "GET" },
    READ_TIMEOUT_MS,
  );
}

/**
 * Создаёт как полный, так и частичный возврат: тип определяется переданной
 * суммой относительно суммы исходного платежа.
 */
export async function createYooRefund(
  req: YooRefundRequest,
): Promise<YooRefund> {
  const body = {
    payment_id: requireNonEmpty(req.paymentId, "paymentId"),
    amount: {
      value: kopecksToRubString(req.amountKopecks),
      currency: "RUB" as const,
    },
    description: req.description
      ? requireNonEmpty(req.description, "description")
      : undefined,
  };

  return requestYookassa<YooRefund>(
    "/refunds",
    "createRefund",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": requireIdempotenceKey(req.idempotenceKey),
      },
      body: JSON.stringify(body),
    },
    WRITE_TIMEOUT_MS,
  );
}

export async function getYooRefund(refundId: string): Promise<YooRefund> {
  const id = requireNonEmpty(refundId, "refundId");
  return requestYookassa<YooRefund>(
    `/refunds/${encodeURIComponent(id)}`,
    "getRefund",
    { method: "GET" },
    READ_TIMEOUT_MS,
  );
}

/** Список IP, с которых ЮKassa отправляет уведомления.
 * https://yookassa.ru/developers/using-api/webhooks#ip */
export const YOOKASSA_IP_WHITELIST = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32",
];
