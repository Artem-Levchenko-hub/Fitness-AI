"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_TOPUP_RUB,
  MIN_TOPUP_RUB,
  TOPUP_PACKAGES,
} from "@/lib/billing/pricing";
import { cn } from "@/lib/utils";

export function TopupForm() {
  const [selected, setSelected] = useState<number>(TOPUP_PACKAGES[0].rub);
  const [custom, setCustom] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customRub = Number(custom) || 0;
  const useCustom = custom.length > 0;
  const amountRub = useCustom ? customRub : selected;
  const validAmount =
    Number.isFinite(amountRub) &&
    amountRub >= MIN_TOPUP_RUB &&
    amountRub <= MAX_TOPUP_RUB;

  async function handleCheckout() {
    if (!validAmount || pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/yookassa/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRub }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(j.error ?? `Ошибка ${res.status}`);
        setPending(false);
        return;
      }
      const j = (await res.json()) as { confirmationUrl: string };
      // Редирект на ЮKassa
      window.location.href = j.confirmationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка соединения");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TOPUP_PACKAGES.map((p) => {
          const isActive = !useCustom && selected === p.rub;
          return (
            <button
              key={p.rub}
              type="button"
              onClick={() => {
                setSelected(p.rub);
                setCustom("");
              }}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors min-h-[5rem]",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent",
              )}
              aria-pressed={isActive}
            >
              <p className="tabular text-base font-semibold">{p.label}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {p.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-amount">Или своя сумма (₽)</Label>
        <Input
          id="custom-amount"
          type="number"
          inputMode="numeric"
          min={MIN_TOPUP_RUB}
          max={MAX_TOPUP_RUB}
          step={50}
          placeholder={`от ${MIN_TOPUP_RUB} ₽`}
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
          className="tabular h-11"
        />
        {useCustom && custom.length > 0 && !validAmount ? (
          <p className="text-destructive text-xs">
            Минимум {MIN_TOPUP_RUB} ₽, максимум {MAX_TOPUP_RUB.toLocaleString("ru")} ₽
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!validAmount || pending}
        onClick={handleCheckout}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Открываем ЮKassa…
          </>
        ) : (
          <>Пополнить на {amountRub} ₽ через ЮKassa</>
        )}
      </Button>

      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        После оплаты вернётесь на эту страницу. Зачисление автоматическое в
        течение минуты после подтверждения банка. Возврат средств — в
        соответствии с офертой.
      </p>
    </div>
  );
}
