import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { subscriptionStatus, subscriptionTier } from "./enums";

/** Подписка пользователя. Один user → одна subscription (synced со Stripe).
 *  При отсутствии записи юзер на Free tier. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),
    tier: subscriptionTier("tier").notNull().default("free"),
    status: subscriptionStatus("status"),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "date",
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("subscriptions_status_idx").on(t.status)],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
