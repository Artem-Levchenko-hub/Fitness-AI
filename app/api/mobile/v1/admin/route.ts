import { getBillingReadiness } from "@/lib/billing/readiness";
import { listRecentPayments, listUsersOverview } from "@/lib/repos/admin.repo";

import { adminJson, adminRead } from "./response";

export const dynamic = "force-dynamic";

export function GET() {
  return adminRead(async (adminId) => {
    const [users, payments] = await Promise.all([
      listUsersOverview(adminId),
      listRecentPayments(adminId),
    ]);
    const {
      mode, paymentsEnabled, subscriptionsEnabled, recurringPaymentsEnabled,
      paymentMissing, subscriptionMissing,
    } = getBillingReadiness();
    const activeSince = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return adminJson({
      summary: {
        userCount: users.length,
        active7d: users.filter((user) => (user.lastActivityAt?.getTime() ?? -Infinity) >= activeSince).length,
        totalPurchasedKopecks: users.reduce((total, user) => total + user.totalPurchasedKopecks, 0),
        totalSpentKopecks: users.reduce((total, user) => total + user.totalSpentKopecks, 0),
      },
      billing: {
        mode, paymentsEnabled, subscriptionsEnabled, recurringPaymentsEnabled,
        paymentMissing, subscriptionMissing,
      },
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        lastActivityAt: user.lastActivityAt,
        strengthCount: user.strengthCount,
        circuitCount: user.circuitCount,
        cardioCount: user.cardioCount,
        balanceKopecks: user.balanceKopecks,
        totalPurchasedKopecks: user.totalPurchasedKopecks,
        totalSpentKopecks: user.totalSpentKopecks,
        tier: user.tier,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        userEmail: payment.userEmail,
        kind: payment.kind,
        amountKopecks: payment.amountKopecks,
        status: payment.status,
        createdAt: payment.createdAt,
        refundedAt: payment.refundedAt,
        canRequestRefund: payment.kind === "topup" && payment.status === "succeeded" && !!payment.providerPaymentId,
      })),
    });
  });
}
