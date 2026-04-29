"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, type SignInState } from "@/server/actions/auth";

type Step = "email" | "code";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [savedCallback, setSavedCallback] = useState<string>(
    callbackUrl ?? "/dashboard",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleEmailSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const initialState: SignInState = { status: "idle" };
    const result = await signInWithEmail(initialState, formData);
    setPending(false);

    if (result.status === "sent") {
      setEmail(result.email);
      setSavedCallback(result.callbackUrl);
      setStep("code");
    } else if (result.status === "error") {
      setError(result.message);
    }
  }

  if (step === "code") {
    return (
      <CodeStep
        email={email}
        callbackUrl={savedCallback}
        onBack={() => {
          setStep("email");
          setError(null);
        }}
        onResend={async () => {
          const fd = new FormData();
          fd.set("email", email);
          fd.set("callbackUrl", savedCallback);
          await handleEmailSubmit(fd);
        }}
      />
    );
  }

  return (
    <form
      action={handleEmailSubmit}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="callbackUrl" value={savedCallback} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          disabled={pending}
          aria-invalid={error !== null}
          className="h-12 text-base"
        />
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Отправляем код…
          </>
        ) : (
          "Получить код на email"
        )}
      </Button>
    </form>
  );
}

function CodeStep({
  email,
  callbackUrl,
  onBack,
  onResend,
}: {
  email: string;
  callbackUrl: string;
  onBack: () => void;
  onResend: () => void;
}) {
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resentJustNow, setResentJustNow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleResend() {
    setResending(true);
    setResentJustNow(false);
    await onResend();
    setResending(false);
    setResentJustNow(true);
    setTimeout(() => setResentJustNow(false), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground border-border space-y-3 rounded-2xl border p-6">
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
          <Mail className="size-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Проверьте почту
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Мы отправили 6-значный код на{" "}
            <span className="text-foreground font-medium">{email}</span>. Код
            действует 10 минут.
          </p>
        </div>
      </div>

      <form
        method="GET"
        action="/api/auth/callback/resend"
        className="space-y-4"
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="space-y-2">
          <Label htmlFor="otp">Код из письма</Label>
          <Input
            ref={inputRef}
            id="otp"
            name="token"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123 456"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
            className="tabular h-14 text-center text-2xl font-semibold tracking-[0.4em]"
          />
        </div>

        <Button type="submit" size="xl" className="w-full" disabled={code.length !== 6}>
          Войти
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline disabled:opacity-50"
        >
          {resending
            ? "Отправляем заново…"
            : resentJustNow
              ? "Новый код отправлен"
              : "Не получили код? Отправить заново"}
        </button>
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-3.5" />
            Изменить email
          </button>
        </div>
      </div>
    </div>
  );
}

