"use client";

import { Loader2, Mail } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, type SignInState } from "@/server/actions/auth";

const initialState: SignInState = { status: "idle" };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signInWithEmail,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <div className="bg-card text-card-foreground border-border rounded-xl border p-8 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <Mail className="size-6" />
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight">
          Проверьте почту
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Мы отправили ссылку для входа на{" "}
          <span className="text-foreground font-medium">{state.email}</span>.
          Откройте письмо в течение 10 минут.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}

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
          aria-invalid={state.status === "error"}
        />
        {state.status === "error" ? (
          <p className="text-destructive text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Отправляем…
          </>
        ) : (
          "Войти по ссылке на email"
        )}
      </Button>
    </form>
  );
}
