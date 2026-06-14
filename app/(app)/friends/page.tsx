import { Check, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  listFriendsDetailed,
  listIncomingRequestsDetailed,
  listOutgoingRequestsDetailed,
  type FriendshipWithUser,
} from "@/lib/repos/friends.repo";
import { acceptFriendRequestAction } from "@/server/actions/friends";

import { AddFriendForm } from "./add-friend-form";

export const metadata: Metadata = { title: "Друзья" };

/** Имя для показа: name если есть, иначе email. */
function displayName(u: FriendshipWithUser["user"]): string {
  return u.name?.trim() || u.email;
}

export default async function FriendsPage() {
  const user = await requireUser();
  const [friends, incoming, outgoing] = await Promise.all([
    listFriendsDetailed(user.id),
    listIncomingRequestsDetailed(user.id),
    listOutgoingRequestsDetailed(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          Главная
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Сообщество
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Друзья
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Добавьте друзей по email — позже сможете видеть тренировки друг друга и
          делиться разборами.
        </p>
      </header>

      {incoming.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">
            Входящие заявки
          </h2>
          <ul className="space-y-3">
            {incoming.map((f) => (
              <li
                key={f.friendshipId}
                className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {displayName(f.user)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {f.user.email}
                  </p>
                </div>
                <form action={acceptFriendRequestAction}>
                  <input type="hidden" name="id" value={f.friendshipId} />
                  <Button type="submit" size="lg" className="min-h-14">
                    <Check className="size-4" />
                    Принять
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-card border-border mb-6 rounded-2xl border p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-tight">
          Добавить друга
        </h2>
        <AddFriendForm />
      </section>

      {outgoing.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">
            Исходящие заявки
          </h2>
          <ul className="space-y-3">
            {outgoing.map((f) => (
              <li
                key={f.friendshipId}
                className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    {displayName(f.user)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {f.user.email}
                  </p>
                </div>
                <span className="text-muted-foreground/80 flex shrink-0 items-center gap-1 text-xs font-medium">
                  <Clock className="size-3.5" aria-hidden="true" />
                  Ожидает
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Ваши друзья
        </h2>
        {friends.length === 0 ? (
          <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
            <Users className="size-7 opacity-60" aria-hidden="true" />
            <p className="text-sm">
              Пока никого. Добавьте друга по email выше — тренироваться вместе
              веселее.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {friends.map((f) => (
              <li key={f.friendshipId}>
                <Link
                  href={`/friends/${f.user.id}`}
                  className="bg-card hover:bg-accent/40 border-border flex min-h-14 items-center gap-3 rounded-2xl border p-4 transition-colors"
                >
                  <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {displayName(f.user).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {displayName(f.user)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {f.user.email}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
