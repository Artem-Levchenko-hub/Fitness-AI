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
  const compact = visible.length > 1;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-5 md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <nav
          aria-label="Активные тренировки"
          data-resume-bar
          className="bg-primary text-primary-foreground flex overflow-hidden rounded-2xl shadow-lg"
        >
          {visible.map((resume) => (
          <Link
              key={resume.href}
              href={resume.href}
              title={`${resume.label} — продолжить`}
              className={`flex min-h-14 min-w-0 flex-1 items-center gap-2 border-primary-foreground/15 py-2.5 transition-colors hover:bg-primary-foreground/10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none [&+&]:border-l ${
                compact ? "justify-center px-2" : "justify-between px-4"
              }`}
          >
              <span className="flex min-w-0 items-center gap-2.5">
              <span className="bg-primary-foreground/15 flex size-7 items-center justify-center rounded-full">
                <Play className="size-3.5 fill-current" />
              </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[10px] font-medium tracking-[0.08em] uppercase opacity-70">
                  {resume.label}
                </span>
                  <span className="truncate text-sm font-semibold tracking-tight">
                  Продолжить
                </span>
              </span>
            </span>
              {!compact && (
                <ChevronRight
                  className="size-4 shrink-0 opacity-70"
                  aria-hidden="true"
                />
              )}
          </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
