import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardNavTile({
  href,
  label,
  icon: Icon,
  hint,
  children,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      oai-annotatable={label}
      className="interactive-surface bg-card border-border hover:border-primary/30 focus-visible:ring-ring flex min-h-14 items-center gap-3 rounded-2xl border p-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
    >
      <div className="interactive-icon bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-semibold">{label}</p>
        {children ?? (
          hint ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              {hint}
            </p>
          ) : null
        )}
      </div>
      <ChevronRight className="interactive-chevron text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
