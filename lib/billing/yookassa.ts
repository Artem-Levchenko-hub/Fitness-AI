import { env } from "@/lib/env";

/** Минимальный клиент ЮKassa REST API без зависимости.
 *  https://yookassa.ru/developers/api */

type YooMoney = {
  value: string; // "100.00"
  currency: "RUB";
};

export type YooPaymentRequest = {
  amountKopecks: number;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  /** Уникальный ключ запроса — если повторим с тем же ключом, ЮKassa
   *  вернёт тот же платёж, не создавая новый. */
  idempotenceKey: string;
};

export type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: YooMoney;
  description?: string;
  metadata?: Record<string, string>;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  test: boolean;
  created_at: string;
};

function authHeader(): string {
  const shopId = env.YOOKASSA_SHOP_ID;
  const secretKey = env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA credentials not configured");
  }
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  return `Basic ${credentials}`;
}

export function isYookassaConfigured(): boolean {
  return !!env.YOOKASSA_SHOP_ID && !!env.YOOKASSA_SECRET_KEY;
}

function kopecksToRubString(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}

export async function createYooPayment(
  req: YooPaymentRequest,
): Promise<YooPayment> {
  const body = {
    amount: {
      value: kopecksToRubString(req.amountKopecks),
      currency: "RUB" as const,
    },
    confirmation: {
      type: "redirect",
      return_url: req.returnUrl,
    },
    capture: true,
    description: req.description,
    metadata: req.metadata,
  };

  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": req.idempotenceKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa createPayment failed (${res.status}): ${text}`);
  }
  return (await res.json()) as YooPayment;
}

export async function getYooPayment(paymentId: string): Promise<YooPayment> {
  const res = await fetch(
    `https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YooKassa getPayment failed (${res.status}): ${text}`);
  }
  return (await res.json()) as YooPayment;
}

/** Список IP, с которых ЮKassa отправляет уведомления.
 *  https://yookassa.ru/developers/using-api/webhooks#ip */
export const YOOKASSA_IP_WHITELIST = [
  "185.71.76.0/27",
  "185.71.77.0/27",
  "77.75.153.0/25",
  "77.75.156.11",
  "77.75.156.35",
  "77.75.154.128/25",
  "2a02:5180::/32",
];
