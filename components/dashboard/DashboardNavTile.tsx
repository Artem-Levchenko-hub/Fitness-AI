import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// Единый компактный tile-вход для дашборда (бюджет компоновки H9.1).
// Один компонент, один ряд — новый вход на главную = ещё один такой tile в
// том же `grid grid-cols-2`, а не отдельная большая секция (иначе /sleep,
// /nutrition, /body и т.д. растащат дашборд в ленту карточек).
// `children` — слот превью: H4.1 (week-strip /stats) и H3.1 (лента /friends)
// вставляют сюда данные, не меняя раскладку. Нет children → показывается hint.
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
      className="bg-card border-border hover:border-foreground/20 flex min-h-14 flex-col gap-2 rounded-2xl border p-4 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <ChevronRight className="text-muted-foreground size-4" aria-hidden="true" />
      </div>
      <div>
        <p className="text-foreground text-sm font-semibold">{label}</p>
        {children ?? (
          hint ? (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              {hint}
            </p>
          ) : null
        )}
      </div>
    </Link>
  );
}
