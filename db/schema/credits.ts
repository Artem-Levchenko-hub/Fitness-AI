import { relations } from "drizzle-orm";
import {
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
    amountKopecks: integer("amount_kopecks").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    description: text("description"),
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
    index("payments_user_idx").on(t.userId, t.createdAt),
    index("payments_status_idx").on(t.status),
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
