"use client";

import {
  ArrowLeftRight,
  Check,
  Dumbbell,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AiQuotaOverview } from "@/lib/billing/ai-quota-policy";
import { formatRub } from "@/lib/billing/money";
import { cn } from "@/lib/utils";

type Plan = {
  code: "pro_monthly" | "pro_yearly";
  title: string;
  priceKopecks: number;
  intervalLabel: string;
  benefits: readonly string[];
};

type SubscriptionView = {
  planCode: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  renewalAvailable: boolean;
} | null;

export function SubscriptionCard({
  plans,
  subscription,
  enabled,
  recurringEnabled,
  mode,
  initialQuotaOverview,
}: {
  plans: readonly Plan[];
  subscription: SubscriptionView;
  enabled: boolean;
  recurringEnabled: boolean;
  mode: "test" | "live";
  initialQuotaOverview: AiQuotaOverview | null;
}) {
  const [selectedPlan, setSelectedPlan] = useState<Plan["code"]>(
    plans[0]?.code ?? "pro_monthly",
  );
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaOverview, setQuotaOverview] = useState(initialQuotaOverview);
  const [confirmingExchange, setConfirmingExchange] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const active =
    (subscription?.status === "active" || subscription?.status === "trialing") &&
    !!subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date();
  const selected = plans.find((plan) => plan.code === selectedPlan) ?? plans[0];

  async function startSubscription() {
    if (!selected || !accepted || pending) return;
    setPending(true);
    setError(null);
    idempotencyKeyRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/yookassa/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: selected.code,
          idempotencyKey: idempotencyKeyRef.current,
          paymentMode: recurringEnabled ? "recurring" : "one_time",
          acceptTerms: true,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        confirmationUrl?: string;
        returnUrl?: string;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? `Ошибка ${response.status}`);
        setPending(false);
        return;
      }
      const destination = body?.confirmationUrl ?? body?.returnUrl;
      if (!destination) throw new Error("ЮKassa не вернула ссылку оплаты");
      window.location.href = destination;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не удалось открыть оплату",
      );
      setPending(false);
    }
  }

  async function updateRenewal(action: "cancel" | "resume") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/yookassa/subscription/${action}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Не удалось изменить подписку");
        setPending(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Ошибка соединения");
      setPending(false);
    }
  }

  async function exchangeQuota() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/quota-exchange", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        overview?: AiQuotaOverview;
      } | null;
      if (!response.ok || !body?.overview) {
        setError(body?.message ?? body?.error ?? "Не удалось выполнить обмен");
        setPending(false);
        return;
      }
      setQuotaOverview(body.overview);
      setConfirmingExchange(false);
      setPending(false);
    } catch {
      setError("Ошибка соединения");
      setPending(false);
    }
  }

  if (active && subscription) {
    return (
      <section className="bg-card border-border space-y-4 rounded-2xl border p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Подписка
            </p>
            <h3 className="font-serif mt-1 text-2xl">Fitness AI Pro</h3>
          </div>
          <span className="bg-success/10 text-success rounded-full px-3 py-1 text-xs font-medium">
            Активна
          </span>
        </div>

        <p className="text-muted-foreground text-sm">
          Доступ оплачен до{" "}
          {new Date(subscription.currentPeriodEnd!).toLocaleDateString("ru-RU", {
            dateStyle: "long",
          })}
          .{" "}
          {!recurringEnabled || subscription.cancelAtPeriodEnd
            ? "После этой даты продление отключено."
            : "Следующий платёж пройдёт автоматически."}
        </p>

        {quotaOverview ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <QuotaTile
                icon={Dumbbell}
                label="Разборы тренировок"
                remaining={quotaOverview.remaining.postWorkoutAnalyses}
                limit={quotaOverview.limits.postWorkoutAnalyses}
              />
              <QuotaTile
                icon={MessageCircle}
                label="Вопросы тренеру"
                remaining={quotaOverview.remaining.coachReplies}
                limit={quotaOverview.limits.coachReplies}
              />
            </div>

            {quotaOverview.exchange.completed ? (
              <p className="bg-primary/5 text-muted-foreground rounded-xl px-4 py-3 text-sm leading-relaxed">
                Обмен выполнен: в этом месяце доступно 25 разборов и 40
                вопросов тренеру.
              </p>
            ) : confirmingExchange ? (
              <div className="border-border bg-muted/30 space-y-3 rounded-xl border p-4">
                <p className="text-sm leading-relaxed">
                  Обмен необратим до следующего месяца: лимит вопросов
                  уменьшится с 60 до 40, лимит разборов вырастет с 15 до 25.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="sm:flex-1"
                    disabled={pending}
                    onClick={exchangeQuota}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="size-4" />
                    )}
                    Подтвердить обмен
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirmingExchange(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : quotaOverview.exchange.available ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setConfirmingExchange(true)}
              >
                <ArrowLeftRight className="size-4" />
                Обменять 20 вопросов на 10 разборов
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Обмен недоступен: для него нужно сохранить 20 неиспользованных
                вопросов.
              </p>
            )}
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {!recurringEnabled ? (
          <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm leading-relaxed">
            Автопродление пока недоступно. Повторного списания не будет; после
            окончания периода подписку можно оформить снова.
          </p>
        ) : subscription.cancelAtPeriodEnd && subscription.renewalAvailable ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() => updateRenewal("resume")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Возобновить автопродление
          </Button>
        ) : subscription.cancelAtPeriodEnd ? (
          <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm leading-relaxed">
            Способ оплаты не был сохранён ЮKassa. Текущий доступ продолжит
            работать до указанной даты, после чего подписку можно оформить
            заново.
          </p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground w-full"
            disabled={pending}
            onClick={() => updateRenewal("cancel")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Отключить автопродление
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="bg-card border-border space-y-5 rounded-2xl border p-5 md:p-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary size-5" />
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Подписка Pro
          </p>
        </div>
        <h3 className="font-serif mt-2 text-2xl">
          Персональный AI-тренер всегда рядом
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {plans.map((plan) => {
          const selectedNow = selectedPlan === plan.code;
          return (
            <button
              key={plan.code}
              type="button"
              aria-pressed={selectedNow}
              onClick={() => {
                setSelectedPlan(plan.code);
                idempotencyKeyRef.current = null;
              }}
              className={cn(
                "min-h-24 rounded-xl border p-4 text-left transition-colors",
                selectedNow
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent",
              )}
            >
              <p className="font-medium">{plan.title}</p>
              <p className="font-serif mt-1 text-2xl">
                {formatRub(plan.priceKopecks)}
              </p>
              <p className="text-muted-foreground text-xs">
                {plan.intervalLabel}
              </p>
            </button>
          );
        })}
      </div>

      <ul className="space-y-2">
        {(selected?.benefits ?? []).map((benefit) => (
          <li key={benefit} className="flex gap-2 text-sm">
            <Check className="text-success mt-0.5 size-4 shrink-0" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {!recurringEnabled ? (
        <p className="bg-primary/5 text-muted-foreground rounded-xl px-4 py-3 text-sm leading-relaxed">
          Оплата разовая. Повторных списаний не будет: после окончания периода
          подписку можно оформить снова.
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span className="text-muted-foreground leading-relaxed">
          Я принимаю{" "}
          <Link className="text-foreground underline" href="/legal/offer">
            оферту
          </Link>
          ,{" "}
          <Link className="text-foreground underline" href="/legal/privacy">
            политику конфиденциальности
          </Link>
          {recurringEnabled
            ? " и разрешаю регулярное списание выбранной суммы. Автопродление можно отключить здесь в любой момент."
            : " и подтверждаю разовую оплату выбранного периода без автопродления."}
        </span>
      </label>

      {mode === "test" ? (
        <p className="bg-warning/10 text-warning-foreground rounded-lg px-3 py-2 text-xs">
          Тестовый режим ЮKassa: реальные деньги не списываются.
        </p>
      ) : null}
      {!enabled ? (
        <p className="text-muted-foreground text-sm">
          Оплата появится после регистрации магазина и заполнения реквизитов
          владельца.
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="xl"
        className="w-full"
        disabled={!enabled || !accepted || !selected || pending}
        onClick={startSubscription}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Открываем ЮKassa…
          </>
        ) : (
          <>Оформить за {selected ? formatRub(selected.priceKopecks) : "—"}</>
        )}
      </Button>
    </section>
  );
}

function QuotaTile({
  icon: Icon,
  label,
  remaining,
  limit,
}: {
  icon: typeof Dumbbell;
  label: string;
  remaining: number;
  limit: number;
}) {
  return (
    <div className="bg-muted/30 border-border/70 flex items-center gap-3 rounded-xl border p-3">
      <div className="bg-background text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          Осталось {remaining} из {limit}
        </p>
      </div>
    </div>
  );
}
