import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Профиль" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Профиль
      </h1>

      <section className="bg-card text-card-foreground border-border mt-6 space-y-3 rounded-2xl border p-5">
        <div>
          <p className="text-muted-foreground text-xs">Email</p>
          <p className="text-sm font-medium">{user.email}</p>
        </div>
        {user.name ? (
          <div>
            <p className="text-muted-foreground text-xs">Имя</p>
            <p className="text-sm font-medium">{user.name}</p>
          </div>
        ) : null}
      </section>

      <form action={signOutAction} className="mt-6">
        <Button type="submit" variant="outline" className="w-full">
          Выйти
        </Button>
      </form>

      <p className="text-muted-foreground/70 mt-6 px-1 text-xs">
        Полный профиль (единицы измерения, временная зона, биллинг) появится в
        Phase 6 и далее.
      </p>
    </main>
  );
}
