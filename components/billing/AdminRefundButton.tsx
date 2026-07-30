"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminRefundButton({ paymentId }: { paymentId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    if (pending) {
      return;
    }
    const reason = window.prompt(
      "Причина полного возврата (сохранится в аудите):",
    );
    if (!reason?.trim() || reason.trim().length < 3) return;
    if (
      !window.confirm(
        "Вернуть полный платёж? Сумма сразу резервируется на балансе пользователя и отправляется в ЮKassa.",
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Возврат не выполнен");
        setPending(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Ошибка соединения");
      setPending(false);
    }
  }

  return (
    <div className="space-y-1 text-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={refund}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Undo2 className="size-3.5" />
        )}
        Возврат
      </Button>
      {error ? (
        <p className="text-destructive max-w-48 text-xs">{error}</p>
      ) : null}
    </div>
  );
}
