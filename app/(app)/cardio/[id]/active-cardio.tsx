"use client";

import { Check, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CardioBlock, CardioWorkout } from "@/db/schema";
import {
  cancelCardioAction,
  finishCardioAction,
  logCardioBlockAction,
} from "@/server/actions/cardio";

/** Активная кардио-сессия — клиентский компонент.
 *  Управляет:
 *   - Web Audio API beeps (требует user-gesture для AudioContext, поэтому
 *     init на первый «Старт»).
 *   - точным таймером через performance.now() + requestAnimationFrame
 *     (setInterval плавает на mobile в background).
 *   - wake lock (экран не гаснет в активной сессии).
 *   - per-block логированием на сервер (Server Action) после каждого
 *     work-блока — HR/RPE опционально через панель ниже таймера. */
export function ActiveCardio({
  workout,
  blocks,
}: {
  workout: CardioWorkout;
  blocks: CardioBlock[];
}) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Восстанавливаемся: первый не-completed блок.
    const idx = blocks.findIndex((b) => b.completedAt == null);
    return idx === -1 ? blocks.length : idx;
  });
  const [running, setRunning] = useState(false);
  const [finishNote, setFinishNote] = useState<string>("");
  const [remainingSec, setRemainingSec] = useState(() =>
    blocks[0]?.plannedDurationSec ?? 0,
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const blockStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const totalBlocks = blocks.length;
  const isFinished = currentIndex >= totalBlocks;
  const currentBlock = isFinished ? null : blocks[currentIndex] ?? null;

  // --- Audio: lazy init AudioContext (нужен user gesture) -------------------
  function ensureAudio(): AudioContext {
    if (!audioCtxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }

  function beep(freq: number, durationMs: number) {
    try {
      const ctx = ensureAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.linearRampToValueAtTime(0.001, t + durationMs / 1000);
      osc.start(t);
      osc.stop(t + durationMs / 1000 + 0.02);
    } catch {
      /* пусто — мьют без сбоя */
    }
  }

  function beepWorkStart() {
    beep(880, 250);
  }
  function beepRestStart() {
    beep(440, 250);
  }
  function beepFinish() {
    beep(880, 150);
    setTimeout(() => beep(1100, 150), 200);
    setTimeout(() => beep(1320, 350), 400);
  }
  function beepCountdown() {
    beep(660, 100);
  }

  // --- Wake lock -----------------------------------------------------------
  async function acquireWakeLock() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.wakeLock && nav.wakeLock.request) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* нет поддержки — ничего страшного */
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }

  // --- Timer loop ----------------------------------------------------------
  useEffect(() => {
    if (!running || !currentBlock) return;

    if (blockStartRef.current == null) {
      blockStartRef.current = performance.now();
    }

    const targetMs = currentBlock.plannedDurationSec * 1000;
    let lastCountdownAt = -1;

    function tick() {
      if (!running || !currentBlock || blockStartRef.current == null) return;
      const elapsed = performance.now() - blockStartRef.current;
      const remainMs = Math.max(0, targetMs - elapsed);
      const remainSec = Math.ceil(remainMs / 1000);
      setRemainingSec(remainSec);

      // Биипы за 3,2,1 сек до конца
      if (remainSec <= 3 && remainSec > 0 && remainSec !== lastCountdownAt) {
        beepCountdown();
        lastCountdownAt = remainSec;
      }

      if (remainMs <= 0) {
        finishBlock();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, currentIndex]);

  async function finishBlock() {
    if (!currentBlock) return;

    const actualDurationSec = currentBlock.plannedDurationSec;
    // Сохраняем на сервер (fire-and-forget — UX не должен ждать)
    const fd = new FormData();
    fd.append("cardioId", workout.id);
    fd.append("blockId", currentBlock.id);
    fd.append("actualDurationSec", String(actualDurationSec));
    void logCardioBlockAction({ status: "idle" }, fd);

    const next = currentIndex + 1;
    blockStartRef.current = null;

    if (next >= totalBlocks) {
      // Все блоки сделаны
      beepFinish();
      setCurrentIndex(next);
      setRunning(false);
      releaseWakeLock();
      router.refresh();
      return;
    }

    const nextBlock = blocks[next]!;
    if (nextBlock.kind === "work") beepWorkStart();
    else beepRestStart();

    setCurrentIndex(next);
    setRemainingSec(nextBlock.plannedDurationSec);
  }

  // --- Cleanup wake lock on unmount ----------------------------------------
  useEffect(() => releaseWakeLock, []);

  async function start() {
    ensureAudio();
    await acquireWakeLock();
    if (currentBlock?.kind === "work") beepWorkStart();
    else beepRestStart();
    blockStartRef.current = performance.now();
    setRunning(true);
  }

  function pause() {
    setRunning(false);
    if (blockStartRef.current != null && currentBlock) {
      // Сохраняем оставшееся время через сокращение плана для текущего блока
      // (простая модель: блок при возобновлении пойдёт с того же отрезка).
      // На самом деле — переустанавливаем blockStartRef так, чтобы elapsed
      // соответствовал тому же remaining. Делаем при resume.
    }
    // Запоминаем remainingSec — резюм использует его (см. resume()).
  }

  function resume() {
    ensureAudio();
    // Сдвигаем виртуальный start, чтобы elapsed === planned - remaining.
    if (currentBlock) {
      const elapsedSec = currentBlock.plannedDurationSec - remainingSec;
      blockStartRef.current = performance.now() - elapsedSec * 1000;
    }
    setRunning(true);
  }

  async function skipForward() {
    if (!currentBlock) return;
    await finishBlock();
  }

  async function cancelAll() {
    if (!confirm("Прервать кардио? Прогресс сохранится, статус — cancelled.")) return;
    releaseWakeLock();
    setRunning(false);
    const fd = new FormData();
    fd.append("cardioId", workout.id);
    await cancelCardioAction(fd);
  }

  async function finishAll() {
    releaseWakeLock();
    setRunning(false);
    const fd = new FormData();
    fd.append("cardioId", workout.id);
    const note = finishNote.trim();
    if (note) fd.append("notes", note.slice(0, 500));
    await finishCardioAction(fd);
  }

  if (isFinished) {
    return (
      <section className="bg-success/5 border-success/20 rounded-2xl border p-6 text-center">
        <div className="bg-success/15 text-success mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
          <Check className="size-6" />
        </div>
        <p className="text-base font-semibold">Все блоки сделаны 💪</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Сохраним и покажем итог.
        </p>
        <div className="mt-4 space-y-1.5 text-left">
          <label
            htmlFor="cardio-finish-note"
            className="text-muted-foreground block text-xs font-medium"
          >
            Как прошла кардио?{" "}
            <span className="opacity-70">(необязательно)</span>
          </label>
          <Textarea
            id="cardio-finish-note"
            value={finishNote}
            onChange={(e) => setFinishNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Самочувствие, дыхание, что было тяжело — тренер учтёт это в разборе"
            className="resize-none"
          />
        </div>
        <Button size="lg" className="mt-4 w-full" onClick={finishAll}>
          Завершить и сохранить
        </Button>
      </section>
    );
  }

  const isWork = currentBlock?.kind === "work";
  const progress = currentBlock
    ? 1 - remainingSec / currentBlock.plannedDurationSec
    : 0;

  return (
    <section className="space-y-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-8 text-center transition-colors",
          isWork
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-card-foreground border-border",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear",
            isWork ? "bg-primary-foreground/12" : "bg-primary/10",
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
        <div className="relative">
          <p className="text-[10px] font-medium tracking-[0.2em] uppercase opacity-70">
            {currentBlock?.label}
          </p>
          <p className="font-serif tabular mt-2 text-7xl font-normal tracking-tighter md:text-8xl">
            {formatMmSs(remainingSec)}
          </p>
          <p className="tabular mt-1 text-xs opacity-60">
            Блок {currentIndex + 1} / {totalBlocks}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {!running ? (
          <Button
            type="button"
            size="lg"
            className="flex-1 text-base"
            onClick={blockStartRef.current ? resume : start}
          >
            <Play className="size-5 fill-current" />
            {blockStartRef.current ? "Продолжить" : "Старт"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1 text-base"
            onClick={pause}
          >
            <Pause className="size-5" />
            Пауза
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={skipForward}
          aria-label="Следующий блок"
        >
          <Square className="size-5" />
        </Button>
      </div>

      <HrRpePanel
        cardioId={workout.id}
        block={currentBlock}
        disabled={!currentBlock || currentBlock.kind !== "work"}
      />

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={cancelAll}
        >
          <X className="size-4" />
          Прервать
        </Button>
      </div>

      <BlockList blocks={blocks} currentIndex={currentIndex} />
    </section>
  );
}

function HrRpePanel({
  cardioId,
  block,
  disabled,
}: {
  cardioId: string;
  block: CardioBlock | null;
  disabled: boolean;
}) {
  const [hr, setHr] = useState<string>("");
  const [rpe, setRpe] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Reset HR/RPE when block changes. Это синхронизация с внешним id —
    // легитимный setState в effect, а не cascading re-render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setHr("");
    setRpe("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [block?.id]);

  if (!block) return null;
  if (disabled) {
    return (
      <p className="text-muted-foreground text-center text-xs">
        Отдых — HR/RPE для текущего блока не требуется.
      </p>
    );
  }

  async function save() {
    if (!block) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("cardioId", cardioId);
      fd.append("blockId", block.id);
      fd.append("actualDurationSec", String(block.plannedDurationSec));
      if (hr) fd.append("hrAvg", hr);
      if (rpe) fd.append("rpe", rpe);
      await logCardioBlockAction({ status: "idle" }, fd);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
        Текущий блок · по желанию
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-muted-foreground text-[11px]">HR (уд/мин)</span>
          <NumberField
            value={hr}
            onChange={setHr}
            placeholder="—"
            className="tabular mt-1 h-11 w-full text-base font-medium"
          />
        </label>
        <label className="block">
          <span className="text-muted-foreground text-[11px]">RPE 1-10</span>
          <NumberField
            decimal
            value={rpe}
            onChange={setRpe}
            placeholder="—"
            className="tabular mt-1 h-11 w-full text-base font-medium"
          />
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        onClick={save}
        disabled={saving || (!hr && !rpe)}
      >
        {saving ? "Сохраняю…" : "Сохранить HR/RPE"}
      </Button>
    </div>
  );
}

function BlockList({
  blocks,
  currentIndex,
}: {
  blocks: CardioBlock[];
  currentIndex: number;
}) {
  return (
    <details className="bg-card border-border rounded-2xl border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Все блоки ({blocks.length})
      </summary>
      <ul className="tabular mt-3 space-y-1.5 text-xs">
        {blocks.map((b, i) => {
          const done = b.completedAt != null || i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={b.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded px-2 py-1",
                active && "bg-primary/10 text-primary",
                done && !active && "text-muted-foreground line-through",
              )}
            >
              <span>
                {i + 1}. {b.label}
              </span>
              <span className="tabular">{formatMmSs(b.plannedDurationSec)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function formatMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
