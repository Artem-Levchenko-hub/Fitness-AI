"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

import { deleteRefreshToken } from "./session-storage";

/** Очищает refresh-токен из localStorage + IndexedDB перед серверным
 *  signOut. Иначе следующий заход на /login auto-restore сразу же
 *  воссоздаст сессию — выйти не получится. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await deleteRefreshToken();
    await signOutAction();
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="text-muted-foreground w-full"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
    >
      Выйти
    </Button>
  );
}
