"use client";

import { Check, Egg, Moon, Sunrise } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { morningContext, morningPromptAllowed, shouldShowMorningPrompt } from "@/lib/domain/wellness/morning";
import { getMorningWellnessStatus, saveMorningWellnessAction, type MorningWellnessStatus } from "@/server/actions/morning-wellness";

// Keep the same-session guarantee when a browser blocks localStorage.
const seenDates = new Map<string, string>();
const storageKey = (userId: string) => `fitness:morning-wellness:v1:${userId}`;

function wasSeen(userId: string, date: string): boolean {
  if (seenDates.get(userId) === date) return true;
  try { return localStorage.getItem(storageKey(userId)) === date; } catch { return false; }
}

function markSeen(userId: string, date: string) {
  seenDates.set(userId, date);
  try { localStorage.setItem(storageKey(userId), date); } catch { /* session memory remains available */ }
}

export function MorningWellnessPrompt({ userId, timeZone }: { userId: string; timeZone: string }) {
  const pathname = usePathname();
  if (!morningPromptAllowed(pathname)) return null;
  // Route changes dispose of both pending checks and an open dialog immediately.
  return <MorningPromptEntry key={`${userId}:${pathname}`} userId={userId} timeZone={timeZone} />;
}

function MorningPromptEntry({ userId, timeZone }: { userId: string; timeZone: string }) {
  const [status, setStatus] = useState<MorningWellnessStatus | null>(null);
  const openedDate = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let checking = false;
    async function check() {
      if (document.visibilityState === "hidden") return;
      const context = morningContext(new Date(), timeZone);
      if (openedDate.current && openedDate.current !== context.date) {
        openedDate.current = null;
        setStatus(null);
      }
      if (checking || openedDate.current || !shouldShowMorningPrompt(
        context, { sleep: false, protein: false }, wasSeen(userId, context.date) ? context.date : null,
      )) return;
      checking = true;
      try {
        const next = await getMorningWellnessStatus();
        if (!active || !next) return;
        const current = morningContext(new Date(), next.timeZone);
        if (current.date !== next.date || !current.isMorning || wasSeen(userId, next.date)) return;
        // A completed morning needs no further automatic checks that day.
        markSeen(userId, next.date);
        if (shouldShowMorningPrompt(current, { sleep: next.sleepRecorded, protein: next.proteinRecorded }, null)) {
          openedDate.current = next.date;
          setStatus(next);
        }
      } catch {
        // Retry at the next entry/focus/minute without interrupting the app.
      } finally { checking = false; }
    }
    void check();
    const interval = window.setInterval(() => { void check(); }, 60_000);
    const onWake = () => { void check(); };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [userId, timeZone]);

  return status ? <MorningWellnessForm key={status.date} status={status} onClose={() => setStatus(null)} /> : null;
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

function MorningWellnessForm({ status, onClose }: { status: MorningWellnessStatus; onClose: () => void }) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [hours, setHours] = useState("");
  const [protein, setProtein] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto rounded-3xl p-5 sm:p-6"
        showCloseButton={!pending}
        onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
      >
        <DialogHeader className="text-left">
          <span className="bg-primary/10 text-primary mb-1 flex size-11 items-center justify-center rounded-2xl"><Sunrise className="size-6" aria-hidden /></span>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl outline-none">Доброе утро</DialogTitle>
          <DialogDescription>Запишите сон и вчерашний белок для статистики восстановления. Можно заполнить одно поле или оба.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setError(null);
          startTransition(async () => {
            try {
              const result = await saveMorningWellnessAction(formData);
              if (result.status === "error") setError(result.message);
              else { onClose(); router.refresh(); }
            } catch { setError("Не удалось сохранить. Проверьте соединение и попробуйте ещё раз."); }
          });
        }} className="space-y-4">
          <input type="hidden" name="date" value={status.date} />
          <div className="bg-muted/40 rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Moon className="text-primary size-4" aria-hidden />Сон</div>
            {status.sleepRecorded ? <p className="text-muted-foreground flex items-center gap-1.5 text-sm"><Check className="size-4" aria-hidden />За прошедшую ночь уже записан</p> : <>
              <Label htmlFor="morning-hours">Сон за прошедшую ночь, ч</Label>
              <p id="morning-sleep-date" className="text-muted-foreground mt-1 text-xs">Пробуждение {dateLabel(status.date)}</p>
              <NumberField id="morning-hours" name="hours" decimal value={hours} onChange={setHours} placeholder="7.5" maxLength={5} disabled={pending} aria-describedby="morning-sleep-date" className="mt-2 h-12" />
            </>}
          </div>
          <div className="bg-muted/40 rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Egg className="text-primary size-4" aria-hidden />Белок</div>
            {status.proteinRecorded ? <p className="text-muted-foreground flex items-center gap-1.5 text-sm"><Check className="size-4" aria-hidden />За вчера уже записан</p> : <>
              <Label htmlFor="morning-protein">Белок за вчера, г</Label>
              <p id="morning-protein-date" className="text-muted-foreground mt-1 text-xs">Питание {dateLabel(status.proteinDate)}</p>
              <NumberField id="morning-protein" name="proteinG" decimal value={protein} onChange={setProtein} placeholder="120" maxLength={6} disabled={pending} aria-describedby="morning-protein-date" className="mt-2 h-12" />
            </>}
          </div>
          {error ? <p role="alert" className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">{error}</p> : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" size="lg" disabled={pending || (!hours.trim() && !protein.trim())} aria-busy={pending} className="w-full">{pending ? "Сохраняю…" : "Сохранить"}</Button>
            <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={onClose} className="w-full">Пропустить сегодня</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
