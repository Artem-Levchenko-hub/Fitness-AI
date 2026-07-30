import { isNotNull, relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { subscriptionStatus, subscriptionTier } from "./enums";

/** Provider-neutral подписка пользователя.
 *
 * ЮKassa не создаёт отдельный subscription-объект: приложение само хранит
 * период и расписание продления, а у провайдера — только сохранённый
 * payment_method_id. Старые Stripe-поля пока остаются nullable для
 * безболезненной миграции уже существующей схемы.
 *
 * При отсутствии записи пользователь находится на Free tier. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("yookassa"),
    providerPaymentMethodId: text("provider_payment_method_id"),
    planCode: text("plan_code"),
    priceKopecks: integer("price_kopecks"),

    /** Legacy Stripe columns. No new ЮKassa flow writes them. */
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),

    tier: subscriptionTier("tier").notNull().default("free"),
    status: subscriptionStatus("status"),
    currentPeriodStart: timestamp("current_period_start", {
      mode: "date",
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "date",
      withTimezone: true,
    }),
    nextChargeAt: timestamp("next_charge_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", {
      mode: "date",
      withTimezone: true,
    }),

    /** Аудит явного согласия на рекуррентные списания. */
    recurringConsentAt: timestamp("recurring_consent_at", {
      mode: "date",
      withTimezone: true,
    }),
    recurringConsentVersion: text("recurring_consent_version"),
    renewalReminderSentAt: timestamp("renewal_reminder_sent_at", {
      mode: "date",
      withTimezone: true,
    }),

    retryCount: integer("retry_count").notNull().default(0),
    lastPaymentId: text("last_payment_id"),
    lastError: text("last_error"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("subscriptions_status_idx").on(t.status),
    index("subscriptions_next_charge_idx").on(t.nextChargeAt, t.status),
    uniqueIndex("subscriptions_provider_method_unq")
      .on(t.provider, t.providerPaymentMethodId)
      .where(isNotNull(t.providerPaymentMethodId)),
  ],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const AI_BILLING_OPERATION_STATUSES = [
  "processing",
  "succeeded",
  "failed",
] as const;
export const AI_BILLING_COVERAGE = ["subscription", "wallet"] as const;

/** Durable single-flight для платных AI-ответов.
 *
 * Не даёт двум одинаковым concurrent stream разделить одно списание и хранит
 * готовый текст для безопасного idempotent retry после потери соединения. */
export const aiBillingOperations = pgTable(
  "ai_billing_operations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: text("workout_id").notNull(),
    kind: text("kind").notNull().default("coach_reply"),
    status: text("status", { enum: AI_BILLING_OPERATION_STATUSES })
      .notNull()
      .default("processing"),
    coverage: text("coverage", { enum: AI_BILLING_COVERAGE }).notNull(),
    attempt: integer("attempt").notNull().default(1),
    priceKopecks: integer("price_kopecks").notNull().default(0),
    chargedAt: timestamp("charged_at", { mode: "date", withTimezone: true }),
    responseText: text("response_text"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ai_billing_ops_user_created_idx").on(t.userId, t.createdAt),
    index("ai_billing_ops_status_updated_idx").on(t.status, t.updatedAt),
  ],
);

export type AiBillingOperation = typeof aiBillingOperations.$inferSelect;
