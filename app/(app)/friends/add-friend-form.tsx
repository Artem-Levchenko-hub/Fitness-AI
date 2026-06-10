"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  sendFriendRequestAction,
  type FriendRequestState,
} from "@/server/actions/friends";

const initial: FriendRequestState = { status: "idle" };

export function AddFriendForm() {
  const [state, formAction, pending] = useActionState<
    FriendRequestState,
    FormData
  >(sendFriendRequestAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-4"
      key={state.status === "success" ? "reset" : "form"}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email друга</Label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="friend@example.com"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>

      {state.status === "error" ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="bg-success/10 text-success border-success/20 rounded-md border px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
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
          <>
            <UserPlus className="size-4" />
            Отправить заявку
          </>
        )}
      </Button>
    </form>
  );
}
