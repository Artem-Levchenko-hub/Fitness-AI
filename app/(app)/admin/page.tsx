import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatRub } from "@/lib/billing/money";
import {
  listUsersOverview,
  type AdminUserOverview,
} from "@/lib/repos/admin.repo";

export const metadata: Metadata = { title: "Админ" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Обзор владельца: все пользователи, их активность и траты. Гейт —
 *  requireAdmin (404 для не-админа). Карточка ведёт на /friends/[id] —
 *  админ-обход в getFriendProfile показывает тренировки и программы юзера
 *  так же, как страницу друга. */
export default async function AdminPage() {
  const admin = await requireAdmin();
  const users = await listUsersOverview(admin.id);

  const now = new Date();
  const active7d = users.filter(
    (u) =>
      u.lastActivityAt &&
      now.getTime() - u.lastActivityAt.getTime() <= 7 * DAY_MS,
  ).length;
  const totalPurchased = users.reduce(
    (s, u) => s + u.totalPurchasedKopecks,
    0,
  );
  const totalSpent = users.reduce((s, u) => s + u.totalSpentKopecks, 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          Главная
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] uppercase">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Владелец
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Пользователи
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Кто как пользуется приложением: активность, тренировки и траты.
          Открой любого — увидишь его тренировки и программы как у друга.
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3">
        <SummaryCard
          icon={<Users className="size-4" aria-hidden="true" />}
          label="Пользователей"
          value={String(users.length)}
          sub={`активны за 7 дней: ${active7d}`}
        />
        <SummaryCard
          icon={<Wallet className="size-4" aria-hidden="true" />}
          label="Куплено кредитов"
          value={formatRub(totalPurchased)}
          sub={`потрачено: ${formatRub(totalSpent)}`}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Все пользователи
        </h2>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">Пока никого.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => (
              <li key={u.id}>
                <UserCard user={u} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 text-xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground/80 tabular mt-0.5 text-xs">{sub}</p>
    </div>
  );
}

function displayName(u: { name: string | null; email: string }): string {
  return u.name?.trim() || u.email;
}

/** Карточка пользователя: активность + тренировки + деньги. Тап ≥56px (R-41). */
function UserCard({ user }: { user: AdminUserOverview }) {
  const workoutsTotal =
    user.strengthCount + user.circuitCount + user.cardioCount;
  const paidTier = user.tier && user.tier !== "free" ? user.tier : null;

  return (
    <Link
      href={`/friends/${user.id}`}
      className="bg-card hover:bg-accent/40 border-border block min-h-14 rounded-2xl border p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {displayName(user).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold tracking-tight">
            <span className="truncate">{displayName(user)}</span>
            {paidTier ? (
              <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                {paidTier}
              </span>
            ) : null}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {user.email} · рег. {formatDate(user.createdAt)}
          </p>
        </div>
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </div>

      <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
        <KPI
          label={
            user.lastActivityAt
              ? `активен ${formatDate(user.lastActivityAt)}`
              : "не тренировался"
          }
          value={`${workoutsTotal} трен.`}
        />
        <KPI label="потратил" value={formatRub(user.totalSpentKopecks)} />
        <KPI label="баланс" value={formatRub(user.balanceKopecks)} />
      </dl>
      {workoutsTotal > 0 ? (
        <p className="text-muted-foreground/70 tabular mt-2 text-[11px]">
          силовые {user.strengthCount} · круговые {user.circuitCount} · кардио{" "}
          {user.cardioCount}
        </p>
      ) : null}
    </Link>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-foreground tabular truncate text-sm font-semibold">
        {value}
      </p>
      <p className="mt-0.5 truncate">{label}</p>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
