import { ArrowRight, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  aiCoachPriceKopecks,
  formatRub,
} from "@/lib/billing/pricing";
import { isYookassaConfigured } from "@/lib/billing/yookassa";
import {
  getOrCreateBalance,
  listTransactions,
} from "@/lib/repos/credits.repo";

import { TopupForm } from "./topup-form";

export const metadata: Metadata = { title: "Баланс" };

type Props = { searchParams: Promise<{ payment?: string }> };

export default async function BillingPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;

  const [balance, transactions] = await Promise.all([
    getOrCreateBalance(user.id),
    listTransactions(user.id, 12),
  ]);

  const yookassaOn = isYookassaConfigured();
  const coachPrice = aiCoachPriceKopecks();
  const justCame = !!sp.payment;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Кошелёк
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Баланс
        </h1>
      </header>

      <section className="bg-card border-border mb-6 rounded-2xl border p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
            <Wallet className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Доступно
            </p>
            <p className="font-serif tabular mt-0.5 text-4xl font-normal tracking-tight">
              {formatRub(balance.balanceKopecks)}
            </p>
            <p className="text-muted-foreground tabular mt-2 text-xs">
              ≈ {Math.floor(balance.balanceKopecks / coachPrice)} разговоров с
              коучем · 1 разговор = {formatRub(coachPrice)}
            </p>
          </div>
        </div>
      </section>

      {justCame ? (
        <section className="bg-success/5 border-success/20 mb-6 rounded-xl border p-4 text-sm">
          Платёж зарегистрирован. Если деньги пришли в ЮKassa, баланс
          обновится в течение минуты — обновите страницу.
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Пополнить
        </h2>
        {yookassaOn ? (
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
        ЮKassa пока не подключена. Владельцу проекта нужно добавить{" "}
        <code className="bg-muted rounded px-1 py-0.5">YOOKASSA_SHOP_ID</code> и{" "}
        <code className="bg-muted rounded px-1 py-0.5">YOOKASSA_SECRET_KEY</code>{" "}
        в <code className="bg-muted rounded px-1 py-0.5">.env.production</code>.
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
