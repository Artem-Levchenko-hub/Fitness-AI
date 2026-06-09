import type { TrendStatus } from "@/lib/domain/progression/trend";

/** Презентационное отображение статуса тренда (цвет/иконка). Отдельно от
 *  чистого домена (R-7): домен (`trend.ts`) хранит СЕМАНТИКУ (тип/подпись/
 *  классификацию), здесь — UI-токены. Один источник правды для F4 (карточка
 *  разбора `TrainerResultCard`) и F7 (графики `/stats`): одинаковый цвет/смысл. */
export type TrendTone = {
  /** Tailwind-класс цвета текста (бейдж, инлайн-дельта). */
  text: string;
  /** Tailwind-класс фона (подложка строки/бейджа). */
  bg: string;
  /** Глиф-индикатор статуса (компактный знак). */
  icon: string;
  /** CSS-переменная для SVG `stroke`/`fill` — Recharts не принимает
   *  Tailwind-класс напрямую, нужен реальный цвет токена (R-36). */
  stroke: string;
};

/** Рост — зелёным, регресс — мягко-красным, стагнация — серым, новое —
 *  нейтрально-акцентным. */
export const TREND_TONE: Record<TrendStatus, TrendTone> = {
  improved: {
    text: "text-success",
    bg: "bg-success/10",
    icon: "↑",
    stroke: "var(--success)",
  },
  regressed: {
    text: "text-destructive/80",
    bg: "bg-destructive/5",
    icon: "↓",
    stroke: "var(--destructive)",
  },
  stagnant: {
    text: "text-muted-foreground",
    bg: "bg-muted/60",
    icon: "=",
    stroke: "var(--muted-foreground)",
  },
  new: {
    text: "text-foreground",
    bg: "bg-primary/5",
    icon: "•",
    stroke: "var(--primary)",
  },
};
