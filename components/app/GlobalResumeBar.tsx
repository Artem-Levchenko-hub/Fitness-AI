"use client";

import { ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type ResumeView,
  visibleResumes,
} from "@/components/dashboard/resume-visibility";
import { getActiveResumes } from "@/server/actions/active-resumes";

/** Глобальная полоса возобновления (H12.4): активная сессия (силовая/круговая/
 *  кардио) видна с ЛЮБОГО экрана, а не только с /dashboard и /workouts. Раньше
 *  H6-дрилл и H12.1 уводили из активной тренировки на /exercises, а путь назад
 *  требовал помнить про баннер на другом экране (канон H4.3 — один носитель).
 *
 *  Свежесть: layout client-кэшируется и НЕ ре-рендерится при навигации (Next
 *  docs), поэтому данные нельзя брать только из server-fetch layout — полоса бы
 *  застыла. `initial` даёт корректный первый кадр (SSR), дальше клиент
 *  перезапрашивает при каждой смене pathname (Client Component ре-рендерится на
 *  навигации). Сама полоса — ТОЛЬКО навигация «Продолжить»; «Убрать» живёт в
 *  карточке самой сессии (H12.4 под-слайс 1). */
export function GlobalResumeBar({ initial }: { initial: ResumeView[] }) {
  const pathname = usePathname();
  const [resumes, setResumes] = useState<ResumeView[]>(initial);

  useEffect(() => {
    let active = true;
    getActiveResumes()
      .then((next) => {
        if (active) setResumes(next);
      })
      .catch(() => {
        // Fail-soft (R-10): полоса — навигационное удобство, не критичный путь;
        // при сбое оставляем последнее известное состояние, не падаем.
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const visible = visibleResumes(resumes, pathname);
  if (visible.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-5 md:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        {visible.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            data-resume-bar
            className="bg-primary text-primary-foreground flex min-h-12 items-center justify-between rounded-2xl px-4 py-2.5 shadow-lg transition-transform hover:-translate-y-px"
          >
            <span className="flex items-center gap-2.5">
              <span className="bg-primary-foreground/15 flex size-7 items-center justify-center rounded-full">
                <Play className="size-3.5 fill-current" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">
                  {r.label}
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  Продолжить
                </span>
              </span>
            </span>
            <ChevronRight className="size-4 opacity-70" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
