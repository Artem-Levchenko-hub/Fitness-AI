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

    /** OpenAI-compat AI gateway (OpenRouter / DeepSeek / любой другой). */
    AI_API_KEY: z.string().min(1).optional(),
    AI_BASE_URL: z
      .string()
      .url()
      .default("https://openrouter.ai/api/v1"),
    AI_MODEL: z.string().min(1).default("deepseek/deepseek-chat"),
    /** Опционально для OpenRouter — сайт-идентификатор для рейтинга. */
    AI_SITE_URL: z.string().url().optional(),
    AI_SITE_NAME: z.string().optional(),

    REDIS_URL: z.string().url().optional(),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRO_YEARLY: z.string().optional(),

    /** ЮKassa shopId + secretKey из личного кабинета:
     *  https://yookassa.ru/my/merchant/integration/api-keys */
    YOOKASSA_SHOP_ID: z.string().optional(),
    YOOKASSA_SECRET_KEY: z.string().optional(),

    /** Цена коуч-сессии в копейках. Default 1000 (10 ₽). */
    AI_COACH_PRICE_KOPECKS: z.coerce.number().int().positive().optional(),

    CRON_SECRET: z.string().min(16).optional(),

    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
