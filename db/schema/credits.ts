import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { creditTxRefType, creditTxType, paymentStatus } from "./enums";

export const PAYMENT_KINDS = [
  "topup",
  "subscription_initial",
  "subscription_renewal",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Баланс пользователя в копейках (для точности — никаких float).
 *  1 credit = 1 копейка. 100 ₽ = 10000 копеек. */
export const userCredits = pgTable("user_credits", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceKopecks: integer("balance_kopecks").notNull().default(0),
  totalPurchasedKopecks: integer("total_purchased_kopecks")
    .notNull()
    .default(0),
  totalSpentKopecks: integer("total_spent_kopecks").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Audit log всех изменений баланса.
 *  amountKopecks: положительное для purchase/refund, отрицательное для spend.
 *  balanceAfterKopecks: snapshot после транзакции (для аудита). */
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: creditTxType("type").notNull(),
    amountKopecks: integer("amount_kopecks").notNull(),
    balanceAfterKopecks: integer("balance_after_kopecks").notNull(),
    description: text("description").notNull(),
    referenceId: text("reference_id"),
    referenceType: creditTxRefType("reference_type"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("credit_tx_user_idx").on(t.userId, t.createdAt),
    index("credit_tx_ref_idx").on(t.referenceType, t.referenceId),
    check(
      "credit_tx_reference_pair_chk",
      sql`(${t.referenceType} is null) = (${t.referenceId} is null)`,
    ),
    /** Exactly-once денежная операция даже при конкурентных webhook. */
    uniqueIndex("credit_tx_reference_type_unq")
      .on(t.userId, t.referenceType, t.referenceId, t.type)
      .where(
        sql`${t.referenceType} is not null and ${t.referenceId} is not null`,
      ),
  ],
);

/** Платежи через ЮKassa (или другие будущие шлюзы). */
export const payments = pgTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ID платежа в ЮKassa (UUID v4). Уникальный. Заполняется после
     *  создания платежа в API ЮKassa. */
    providerPaymentId: text("provider_payment_id"),
    provider: text("provider").notNull().default("yookassa"),
    /** Стабильный request-level ключ. Тот же ключ уходит в Idempotence-Key. */
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind", { enum: PAYMENT_KINDS })
      .notNull()
      .default("topup"),
    planCode: text("plan_code"),
    amountKopecks: integer("amount_kopecks").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    description: text("description"),
    receiptEmail: text("receipt_email"),
    recurringConsentAt: timestamp("recurring_consent_at", {
      mode: "date",
      withTimezone: true,
    }),
    recurringConsentVersion: text("recurring_consent_version"),
    customerIp: text("customer_ip"),
    customerUserAgent: text("customer_user_agent"),
    periodStart: timestamp("period_start", {
      mode: "date",
      withTimezone: true,
    }),
    periodEnd: timestamp("period_end", {
      mode: "date",
      withTimezone: true,
    }),
    paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
    canceledAt: timestamp("canceled_at", {
      mode: "date",
      withTimezone: true,
    }),
    refundedAt: timestamp("refunded_at", {
      mode: "date",
      withTimezone: true,
    }),
    refundRequestedAt: timestamp("refund_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    refundRequestedBy: text("refund_requested_by"),
    refundReason: text("refund_reason"),
    providerRefundId: text("provider_refund_id"),
    failureCode: text("failure_code"),
    /** Сырое тело webhook / API response — для аудита и отладки. */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("payments_provider_id_unq").on(
      t.provider,
      t.providerPaymentId,
    ),
    uniqueIndex("payments_idempotency_key_unq").on(t.idempotencyKey),
    uniqueIndex("payments_initial_subscription_inflight_unq")
      .on(t.userId)
      .where(
        sql`${t.kind} = 'subscription_initial' and ${t.status} in ('pending', 'waiting_for_capture')`,
      ),
    index("payments_user_idx").on(t.userId, t.createdAt),
    index("payments_status_idx").on(t.status),
    index("payments_kind_idx").on(t.kind, t.createdAt),
  ],
);

export const userCreditsRelations = relations(userCredits, ({ one }) => ({
  user: one(users, {
    fields: [userCredits.userId],
    references: [users.id],
  }),
}));

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

export type UserCredits = typeof userCredits.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
