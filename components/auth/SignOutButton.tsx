"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

import { purgePrivateRuntimeCache } from "./SessionRefreshSync";
import { clearLegacyRefreshStorage } from "./session-storage";

/** Отзывает HttpOnly refresh на сервере и удаляет только legacy browser state. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await clearLegacyRefreshStorage();
    await purgePrivateRuntimeCache();
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
