import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";

/** Единый баннер «Продолжить» для любой активной сессии (силовая / круговая /
 *  кардио). DRY: раньше три почти одинаковых блока жили в трёх формат-тайлах
 *  дашборда — теперь один компонент, формат различает только подпись (label). */
export function ResumeBanner({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bg-primary text-primary-foreground flex items-center justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-px"
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
          <Play className="size-5 fill-current" />
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
            {label}
          </p>
          <p className="text-base font-semibold tracking-tight">Продолжить</p>
        </div>
      </div>
      <ChevronRight className="size-5 opacity-70" aria-hidden="true" />
    </Link>
  );
}
