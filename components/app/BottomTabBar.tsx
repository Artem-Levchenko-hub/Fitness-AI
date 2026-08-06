"use client";

import { Activity, Dumbbell, Home, User, Wallet } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", icon: Home, label: "Главная" },
  { href: "/workouts", icon: Activity, label: "Тренировки" },
  { href: "/exercises", icon: Dumbbell, label: "Упражнения" },
  { href: "/billing", icon: Wallet, label: "Баланс" },
  { href: "/profile", icon: User, label: "Профиль" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="bg-card/90 border-border supports-[backdrop-filter]:bg-card/70 fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-12px_36px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] backdrop-blur-xl"
      aria-label="Главная навигация"
    >
      <ul className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/tab focus-visible:ring-ring relative flex w-full flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium tracking-tight transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
                  "min-h-14",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 min-w-10 items-center justify-center rounded-full px-2 transition-[background-color,box-shadow,transform] duration-200 ease-out group-active/tab:scale-95 motion-reduce:transform-none",
                    active && "bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_10%,transparent)]",
                  )}
                >
                  <Icon
                    className="size-5 transition-transform duration-200 group-hover/tab:-translate-y-0.5 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                  <TabPendingIndicator />
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TabPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      className="nav-pending-indicator bg-primary absolute top-0 right-1 size-1.5 rounded-full"
    />
  );
}
