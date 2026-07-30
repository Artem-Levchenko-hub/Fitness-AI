"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled"
  | "failed"
  | "refund_pending"
  | "refunded";

export function PaymentReturnStatus({
  paymentId,
  initialStatus,
}: {
  paymentId: string;
  initialStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [temporaryError, setTemporaryError] = useState(false);

  useEffect(() => {
    if (!["pending", "waiting_for_capture", "failed"].includes(status)) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function reconcile() {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/yookassa/payments/${encodeURIComponent(paymentId)}/reconcile`,
          { method: "POST" },
        );
        const body = (await response.json().catch(() => null)) as {
          status?: PaymentStatus;
        } | null;

        if (!cancelled && response.ok && body?.status) {
          setTemporaryError(false);
          setStatus(body.status);
          if (body.status === "succeeded") {
            router.refresh();
            return;
          }
          if (["canceled", "refunded"].includes(body.status)) return;
        } else if (!cancelled && response.status >= 500) {
          setTemporaryError(true);
        }
      } catch {
        if (!cancelled) setTemporaryError(true);
      }

      if (!cancelled && attempts < 12) {
        timer = setTimeout(reconcile, 2_500);
      }
    }

    void reconcile();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, router, status]);

  if (status === "succeeded") {
    return (
      <div className="bg-success/5 border-success/20 mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
        <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
        <p>
          Оплата подтверждена ЮKassa. Баланс или подписка уже обновлены.
        </p>
      </div>
    );
  }

  if (status === "refunded") {
    return (
      <div className="bg-muted border-border mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
        <CheckCircle2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <p>Платёж возвращён через ЮKassa.</p>
      </div>
    );
  }

  if (status === "refund_pending") {
    return (
      <div
        className="bg-primary/5 border-primary/20 mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm"
        aria-live="polite"
      >
        <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
        <p>
          Возврат зарегистрирован. Ждём окончательного подтверждения ЮKassa.
        </p>
      </div>
    );
  }

  if (status === "canceled" || status === "failed") {
    return (
      <div className="bg-destructive/5 border-destructive/20 mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm">
        <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
        <p>
          Платёж пока не подтверждён. Баланс не изменён; если банк уже списал
          деньги, автоматическая сверка обновит статус или банк вернёт сумму.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-primary/5 border-primary/20 mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm"
      aria-live="polite"
    >
      <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
      <p>
        Проверяем подтверждение платежа напрямую в ЮKassa…
        {temporaryError
          ? " ЮKassa временно не ответила — проверка повторится автоматически."
          : ""}
      </p>
    </div>
  );
}
