import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),

    AUTH_SECRET: z.string().min(32),
    AUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),

    RESEND_API_KEY: z.string().min(1),
    /** RFC 5322 формат: "Display Name <email@host>" или просто "email@host". */
    EMAIL_FROM: z.string().min(3),

    /** Основной провайдер тренера — OpenAI-совместимый gateway (Qwen/AITUNNEL). */
    AI_PROVIDER: z.enum(["gemini", "openai"]).default("openai"),

    /** OpenAI-совместимый AI gateway (AITUNNEL / OpenRouter / любой другой). */
    AI_API_KEY: z.string().min(1).optional(),
    AI_BASE_URL: z
      .string()
      .url()
      .default("https://api.aitunnel.ru/v1"),
    AI_MODEL: z.string().min(1).default("qwen3.7-plus"),
    /** Embedding-модель для RAG (OpenAI-совместимый gateway).
     *  text-embedding-3-small = 1536 dim (совпадает с knowledge schema). */
    AI_EMBED_MODEL: z
      .string()
      .min(1)
      .default("text-embedding-3-small"),
    /** Опционально для OpenRouter — сайт-идентификатор для рейтинга. */
    AI_SITE_URL: z.string().url().optional(),
    AI_SITE_NAME: z.string().optional(),

    /** ProxyAPI.ru — российский прокси к OpenAI (модели gpt-5.4-nano и т.п.). */
    PROXYAPI_API_KEY: z.string().min(1).optional(),
    PROXYAPI_BASE_URL: z
      .string()
      .url()
      .default("https://api.proxyapi.ru/openai/v1"),
    PROXYAPI_MODEL: z.string().min(1).default("gpt-5.4-nano"),

    /** Google Gemini (1M context, multimodal). */
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

    /** Прокси для исходящих HTTPS-запросов из Node (например, к Gemini из РФ).
     *  Формат: http://user:pass@host:port или http://host:port. */
    HTTPS_PROXY: z.string().url().optional(),

    /** VAPID-ключи для Web Push. Генерируются `npx web-push generate-vapid-keys`. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    /** mailto:contact@example.com — для push-сервисов как fallback identifier. */
    VAPID_SUBJECT: z.string().optional(),

    REDIS_URL: z.string().url().optional(),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRO_YEARLY: z.string().optional(),

    /** ЮKassa shopId + secretKey из личного кабинета:
     *  https://yookassa.ru/my/merchant/integration/api-keys */
    YOOKASSA_SHOP_ID: z.string().optional(),
    YOOKASSA_SECRET_KEY: z.string().optional(),
    /** Защитный переключатель: test по умолчанию не позволит случайно
     *  обработать live-платёж до явного решения владельца. */
    YOOKASSA_MODE: z.enum(["test", "live"]).default("test"),
    /** Код НДС в чеке ЮKassa. 1 = без НДС; перед live сверить с бухгалтером. */
    YOOKASSA_VAT_CODE: z.coerce.number().int().min(1).max(12).default(1),
    /** Дополнительная IP-проверка webhook. Источник истины всё равно
     *  перепроверяется через GET /payments/{id}. */
    YOOKASSA_WEBHOOK_IP_CHECK: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),

    /** Реквизиты продавца. Без них платёжный UI остаётся fail-closed. */
    LEGAL_OPERATOR_NAME: z.string().min(2).optional(),
    LEGAL_OPERATOR_INN: z.string().regex(/^\d{10}$|^\d{12}$/).optional(),
    LEGAL_OPERATOR_REGISTRATION_ID: z
      .string()
      .regex(/^\d{13}$|^\d{15}$/)
      .optional(),
    LEGAL_OPERATOR_ADDRESS: z.string().min(5).optional(),
    LEGAL_SUPPORT_EMAIL: z.string().email().optional(),
    LEGAL_OFFER_VERSION: z.string().min(1).default("2026-07-30"),
    /** Включается только после проверки опубликованных текстов владельцем/
     *  юристом. Без него checkout остаётся закрыт. */
    LEGAL_DOCUMENTS_APPROVED: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),

    /** Цена одного ответа AI-тренера в копейках. Default 2200 (22 ₽). */
    AI_COACH_PRICE_KOPECKS: z.coerce.number().int().positive().optional(),

    /** Гейтить ли coach по балансу. По умолчанию выкл — пока используем
     *  free-tier Gemini, биллинг включим когда подключим платный провайдер. */
    BILLING_ENABLED: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),

    /** Отдельный fail-closed флаг продажи рекуррентной подписки. */
    SUBSCRIPTION_ENABLED: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),

    /** Право live-магазина сохранять способы оплаты и делать автосписания.
     *  Включается только после подтверждения менеджером ЮKassa. */
    YOOKASSA_RECURRING_ENABLED: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),

    CRON_SECRET: z.string().min(16).optional(),

    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    /** Публичный mirror VAPID public key — нужен в браузере для subscribe(). */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
