import { Trophy, UserRound } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/profile", label: "Профиль", icon: UserRound },
  { href: "/records", label: "Рекорды", icon: Trophy },
] as const;

export function ProfileTabs({ active }: { active: "profile" | "records" }) {
  return (
    <nav
      className="bg-muted/70 mb-6 grid grid-cols-2 rounded-2xl p-1"
      aria-label="Разделы профиля"
    >
      {tabs.map((tab) => {
        const selected = active === tab.href.slice(1);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
              selected
                ? "bg-card text-foreground border-border border shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
