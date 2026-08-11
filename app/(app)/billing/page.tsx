import { ArrowRight, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PaymentReturnStatus } from "@/components/billing/PaymentReturnStatus";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  aiCoachPriceKopecks,
  formatRub,
} from "@/lib/billing/pricing";
import { BILLING_PLANS } from "@/lib/billing/plans";
import { getBillingReadiness } from "@/lib/billing/readiness";
import {
  getOrCreateBalance,
  listTransactions,
} from "@/lib/repos/credits.repo";
import { getPaymentForUser } from "@/lib/repos/payments.repo";
import { getAiQuotaOverview } from "@/lib/repos/ai-quota.repo";
import { getSubscriptionForUser } from "@/lib/repos/subscriptions.repo";

import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Баланс" };

type Props = { searchParams: Promise<{ payment?: string }> };

export default async function BillingPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;
  const readiness = getBillingReadiness();

  const [balance, transactions, subscription, returnPayment, quotaOverview] = await Promise.all([
    getOrCreateBalance(user.id),
    listTransactions(user.id, 12),
    getSubscriptionForUser(user.id),
    sp.payment ? getPaymentForUser(user.id, sp.payment) : Promise.resolve(null),
    getAiQuotaOverview(user.id),
  ]);

  const coachPrice = aiCoachPriceKopecks();
  const yearlyReferencePrice =
    BILLING_PLANS.pro_monthly.priceKopecks * 12;
  const yearlySavings =
    yearlyReferencePrice - BILLING_PLANS.pro_yearly.priceKopecks;
  const yearlySavingsPercent = Math.round(
    (yearlySavings / yearlyReferencePrice) * 100,
  );
  const plans = Object.values(BILLING_PLANS).map((plan) => ({
    code: plan.code,
    title: plan.title,
    priceKopecks: plan.priceKopecks,
    intervalLabel:
      plan.code === "pro_yearly"
        ? `${readiness.recurringPaymentsEnabled ? "списание раз в год" : "доступ на год"} · экономия ${formatRub(yearlySavings)} (${yearlySavingsPercent}%)`
        : readiness.recurringPaymentsEnabled
          ? "списание раз в месяц"
          : "доступ на 1 месяц",
    benefits: plan.benefits.map((benefit) => benefit.label),
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-4">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Кошелёк
        </p>
        <h1 className="font-serif mt-1 text-2xl font-normal tracking-tight md:text-3xl">
          Баланс
        </h1>
      </header>

      {returnPayment ? (
        <PaymentReturnStatus
          paymentId={returnPayment.id}
          initialStatus={returnPayment.status}
        />
      ) : null}

      <div className="mb-6">
        <SubscriptionCard
          plans={plans}
          subscription={
            subscription
              ? {
                  planCode: subscription.planCode,
                  status: subscription.status,
                  currentPeriodEnd:
                    subscription.currentPeriodEnd?.toISOString() ?? null,
                  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                  renewalAvailable: !!subscription.providerPaymentMethodId,
                }
              : null
          }
          enabled={readiness.subscriptionsEnabled}
          recurringEnabled={readiness.recurringPaymentsEnabled}
          mode={readiness.mode}
          initialQuotaOverview={quotaOverview}
        />
      </div>

      <section
        aria-labelledby="available-balance"
        className="bg-muted/25 border-border/60 mb-8 rounded-xl border px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div className="bg-background/70 text-muted-foreground border-border/60 flex size-9 shrink-0 items-center justify-center rounded-lg border">
            <Wallet className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-baseline gap-2">
              <p
                id="available-balance"
                className="text-muted-foreground text-xs font-medium"
              >
                Доступно
              </p>
              <p className="tabular text-lg font-medium tracking-tight">
                {formatRub(balance.balanceKopecks)}
              </p>
            </div>
            <p className="text-muted-foreground tabular mt-0.5 text-[11px] leading-4 text-pretty sm:mt-0 sm:text-right">
              ≈ {Math.floor(balance.balanceKopecks / coachPrice)} ответов
              AI-тренера <span aria-hidden="true">·</span>{" "}
              <span className="whitespace-nowrap">
                1 ответ — {formatRub(coachPrice)}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Пополнить
        </h2>
        {readiness.paymentsEnabled ? (
          <TopupForm />
        ) : (
          <YookassaOffNotice />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          История операций
        </h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Операций пока нет.</p>
        ) : (
          <ul className="bg-card border-border divide-border divide-y rounded-xl border">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{t.description}</p>
                  <p className="text-muted-foreground tabular text-xs">
                    {new Date(t.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span
                  className={`tabular shrink-0 font-medium ${
                    t.amountKopecks > 0 ? "text-success" : "text-foreground"
                  }`}
                >
                  {t.amountKopecks > 0 ? "+" : ""}
                  {formatRub(t.amountKopecks)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function YookassaOffNotice() {
  return (
    <div className="bg-card border-border space-y-3 rounded-2xl border p-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        ЮKassa пока не подключена полностью. Пополнение станет доступно после
        регистрации магазина, заполнения реквизитов продавца и проверки
        оферты.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">
          На главную
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
