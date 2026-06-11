"use client";

import { Activity, Dumbbell, Home, User, Wallet } from "lucide-react";
import Link from "next/link";
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
      className="bg-card/85 border-border supports-[backdrop-filter]:bg-card/65 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-md"
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
                  "flex w-full flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium tracking-tight transition-colors",
                  "min-h-14",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
