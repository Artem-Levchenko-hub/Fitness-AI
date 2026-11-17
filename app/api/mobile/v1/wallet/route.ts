import { getUser } from "@/lib/auth/require-user";
import { MAX_TOPUP_RUB, MIN_TOPUP_RUB, TOPUP_PACKAGES } from "@/lib/billing/money";
import { BILLING_PLANS, hasActiveProAccess } from "@/lib/billing/plans";
import { getBillingReadiness } from "@/lib/billing/readiness";
import { getOrCreateBalance, listTransactions } from "@/lib/repos/credits.repo";
import { getSubscriptionForUser } from "@/lib/repos/subscriptions.repo";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401, headers });
  const [balance, subscription, transactions] = await Promise.all([
    getOrCreateBalance(user.id), getSubscriptionForUser(user.id), listTransactions(user.id, 12),
  ]);
  const readiness = getBillingReadiness();
  return Response.json({
    balanceKopecks: balance.balanceKopecks,
    topupEnabled: readiness.paymentsEnabled,
    subscriptionsEnabled: readiness.subscriptionsEnabled,
    recurringEnabled: readiness.recurringPaymentsEnabled,
    mode: readiness.mode,
    minTopupRub: MIN_TOPUP_RUB,
    maxTopupRub: MAX_TOPUP_RUB,
    packages: TOPUP_PACKAGES.map(({ rub }) => rub),
    plans: Object.values(BILLING_PLANS).map(({ code, title, priceKopecks, interval, benefits }) => ({
      code, title, priceKopecks, interval, benefits: benefits.map(({ label }) => label),
    })),
    subscription: subscription ? {
      active: hasActiveProAccess(subscription, new Date()),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      renewalAvailable: !!subscription.providerPaymentMethodId,
    } : null,
    transactions: transactions.map(({ id, type, amountKopecks, description, createdAt }) => ({
      id, type, amountKopecks, description, createdAt,
    })),
  }, { headers });
}
