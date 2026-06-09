"use client";

import {
  Check,
  Loader2,
  Pause,
  Play,
  SkipForward,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { cn } from "@/lib/utils";
import type {
  CircuitRoundLog,
  CircuitWorkout,
} from "@/db/schema";
import type { CircuitExerciseWithName } from "@/lib/repos/circuits.repo";
import {
  cancelCircuitAction,
  finishCircuitAction,
  logRoundAction,
} from "@/server/actions/circuits";

type Phase = "ready" | "working" | "rest_between_exercises" | "rest_between_rounds" | "done";

/** Активная круговая — client component с таймером и переходами фаз.
 *  Восстанавливает прогресс из logs: первый незаполненный (round × exercise)
 *  становится текущей позицией. */
export function ActiveCircuit({
  workout,
  exercises,
  logs,
}: {
  workout: CircuitWorkout;
  exercises: CircuitExerciseWithName[];
  logs: CircuitRoundLog[];
}) {
  const router = useRouter();

  // Map: `${exerciseId}:${round}` → log; чтобы восстановить позицию.
  const logIndex = useMemo(() => {
    const m = new Map<string, CircuitRoundLog>();
    for (const l of logs) {
      m.set(`${l.circuitExerciseId}:${l.roundNumber}`, l);
    }
    return m;
  }, [logs]);

  // Восстанавливаем стартовую позицию.
  const initial = useMemo(() => findFirstIncomplete(exercises, workout.totalRounds, logIndex), [
    exercises,
    workout.totalRounds,
    logIndex,
  ]);

  const [currentRound, setCurrentRound] = useState(initial.round);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(initial.exerciseIdx);
  const [phase, setPhase] = useState<Phase>(initial.done ? "done" : "ready");
  const [running, setRunning] = useState(false);
  // Working countup в сек для duration; для reps — таймер тоже работает (для аналитики).
  const [elapsedSec, setElapsedSec] = useState(0);
  // Rest countdown
  const [restRemainSec, setRestRemainSec] = useState(0);
  const [saving, setSaving] = useState(false);

  // Override полей при логе раунда: reps/weight можно править вручную.
  const [overrideReps, setOverrideReps] = useState<string>("");
  const [overrideWeight, setOverrideWeight] = useState<string>("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const currentExercise = exercises[currentExerciseIdx] ?? null;
  const totalSlots = workout.totalRounds * exercises.length;
  const doneSlots = logs.filter((l) => !l.skipped).length;

  // --- Audio ---
  function ensureAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtxRef.current = new AC();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }

  function beep(freq: number, durationMs: number) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.linearRampToValueAtTime(0.001, t + durationMs / 1000);
      osc.start(t);
      osc.stop(t + durationMs / 1000 + 0.02);
    } catch {
      /* пусто */
    }
  }

  function beepWork() {
    beep(880, 220);
  }
  function beepRest() {
    beep(440, 220);
  }
  function beepFinishAll() {
    beep(880, 150);
    setTimeout(() => beep(1100, 150), 200);
    setTimeout(() => beep(1320, 350), 400);
  }
  function beepTick() {
    beep(660, 90);
  }

  // --- Wake lock ---
  async function acquireWakeLock() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.wakeLock && nav.wakeLock.request) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* пусто */
    }
  }
  function releaseWakeLock() {
    if (wakeLockRef.current) {
      void wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }
  useEffect(() => releaseWakeLock, []);

  // --- Timer loop (общий для working countup и rest countdown) ---
  useEffect(() => {
    if (!running) return;
    if (phase !== "working" && phase !== "rest_between_exercises" && phase !== "rest_between_rounds") {
      return;
    }
    if (startTsRef.current == null) {
      startTsRef.current = performance.now();
    }

    const isRest =
      phase === "rest_between_exercises" || phase === "rest_between_rounds";
    const restTotal =
      phase === "rest_between_exercises"
        ? workout.restBetweenExercisesSec
        : workout.restBetweenRoundsSec;

    let lastCountdownAt = -1;
    function tick() {
      if (!running || startTsRef.current == null) return;
      const elapsedMs = performance.now() - startTsRef.current;
      const elapsed = Math.floor(elapsedMs / 1000);

      if (isRest) {
        const remain = Math.max(0, restTotal - elapsed);
        setRestRemainSec(remain);
        if (remain <= 3 && remain > 0 && remain !== lastCountdownAt) {
          beepTick();
          lastCountdownAt = remain;
        }
        if (remain <= 0) {
          // отдых закончен — следующая фаза
          startTsRef.current = null;
          setRestRemainSec(0);
          advanceAfterRest();
          return;
        }
      } else {
        // working countup
        setElapsedSec(elapsed);
        if (
          currentExercise?.kind === "duration" &&
          currentExercise.targetDurationSec
        ) {
          const remain = currentExercise.targetDurationSec - elapsed;
          if (remain <= 3 && remain > 0 && remain !== lastCountdownAt) {
            beepTick();
            lastCountdownAt = remain;
          }
          if (remain <= 0) {
            // auto-complete duration
            startTsRef.current = null;
            void completeCurrent(false);
            return;
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, currentExerciseIdx, currentRound]);

  function startWorking() {
    ensureAudio();
    void acquireWakeLock();
    beepWork();
    setOverrideReps("");
    setOverrideWeight(
      currentExercise?.targetWeightKg != null
        ? String(currentExercise.targetWeightKg)
        : "",
    );
    setElapsedSec(0);
    startTsRef.current = performance.now();
    setPhase("working");
    setRunning(true);
  }

  function pauseTimer() {
    setRunning(false);
    if (startTsRef.current != null) {
      // freeze elapsed/remain — при resume пересчитаем startTs.
    }
  }

  function resumeTimer() {
    ensureAudio();
    if (phase === "working") {
      startTsRef.current = performance.now() - elapsedSec * 1000;
    } else if (
      phase === "rest_between_exercises" ||
      phase === "rest_between_rounds"
    ) {
      const restTotal =
        phase === "rest_between_exercises"
          ? workout.restBetweenExercisesSec
          : workout.restBetweenRoundsSec;
      const elapsed = restTotal - restRemainSec;
      startTsRef.current = performance.now() - elapsed * 1000;
    }
    setRunning(true);
  }

  async function completeCurrent(skipped: boolean) {
    if (!currentExercise) return;
    setSaving(true);
    setRunning(false);
    try {
      const fd = new FormData();
      fd.append("circuitId", workout.id);
      fd.append("circuitExerciseId", currentExercise.id);
      fd.append("roundNumber", String(currentRound));
      if (!skipped) {
        if (currentExercise.kind === "reps") {
          const reps = overrideReps.trim()
            ? Number(overrideReps)
            : currentExercise.targetReps ?? 0;
          fd.append("actualReps", String(reps));
        } else {
          fd.append("actualDurationSec", String(elapsedSec || currentExercise.targetDurationSec || 0));
        }
        if (overrideWeight.trim()) {
          fd.append("actualWeightKg", overrideWeight.trim());
        } else if (currentExercise.targetWeightKg != null) {
          fd.append("actualWeightKg", String(currentExercise.targetWeightKg));
        }
      } else {
        fd.append("skipped", "true");
      }
      await logRoundAction({ status: "idle" }, fd);
    } finally {
      setSaving(false);
    }

    // Переход к следующему упражнению/кругу/завершению.
    const nextExerciseIdx = currentExerciseIdx + 1;
    if (nextExerciseIdx < exercises.length) {
      // ещё есть упражнение в текущем круге — короткий отдых
      startTsRef.current = null;
      if (workout.restBetweenExercisesSec > 0) {
        beepRest();
        setRestRemainSec(workout.restBetweenExercisesSec);
        setPhase("rest_between_exercises");
        setRunning(true);
      } else {
        setCurrentExerciseIdx(nextExerciseIdx);
        startWorking();
      }
      return;
    }

    // Круг завершён. Следующий круг или финиш.
    const nextRound = currentRound + 1;
    if (nextRound > workout.totalRounds) {
      startTsRef.current = null;
      setPhase("done");
      setRunning(false);
      releaseWakeLock();
      beepFinishAll();
      router.refresh();
      return;
    }

    startTsRef.current = null;
    if (workout.restBetweenRoundsSec > 0) {
      beepRest();
      setRestRemainSec(workout.restBetweenRoundsSec);
      setPhase("rest_between_rounds");
      setRunning(true);
    } else {
      setCurrentRound(nextRound);
      setCurrentExerciseIdx(0);
      startWorking();
    }
  }

  function advanceAfterRest() {
    if (phase === "rest_between_exercises") {
      setCurrentExerciseIdx((i) => i + 1);
      startWorking();
    } else if (phase === "rest_between_rounds") {
      setCurrentRound((r) => r + 1);
      setCurrentExerciseIdx(0);
      startWorking();
    }
  }

  function skipRest() {
    startTsRef.current = null;
    setRunning(false);
    setRestRemainSec(0);
    advanceAfterRest();
  }

  async function finishAll() {
    releaseWakeLock();
    setRunning(false);
    const fd = new FormData();
    fd.append("circuitId", workout.id);
    await finishCircuitAction(fd);
  }

  async function cancelAll() {
    if (!confirm("Прервать круговую? Прогресс сохранится, статус — cancelled.")) {
      return;
    }
    releaseWakeLock();
    setRunning(false);
    const fd = new FormData();
    fd.append("circuitId", workout.id);
    await cancelCircuitAction(fd);
  }

  // --- Render ---
  if (phase === "done") {
    return (
      <section className="bg-success/5 border-success/20 rounded-2xl border p-6 text-center">
        <div className="bg-success/15 text-success mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
          <Check className="size-6" />
        </div>
        <p className="text-base font-semibold">Все круги пройдены 🔥</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Сохраним и запустим разбор тренером.
        </p>
        <Button size="xl" className="mt-4 w-full" onClick={finishAll}>
          Завершить и сохранить
        </Button>
      </section>
    );
  }

  const isRest =
    phase === "rest_between_exercises" || phase === "rest_between_rounds";
  const restTotal =
    phase === "rest_between_exercises"
      ? workout.restBetweenExercisesSec
      : workout.restBetweenRoundsSec;

  return (
    <section className="space-y-5">
      <ProgressHeader
        currentRound={currentRound}
        totalRounds={workout.totalRounds}
        currentExerciseIdx={currentExerciseIdx}
        exerciseCount={exercises.length}
        doneSlots={doneSlots}
        totalSlots={totalSlots}
      />

      {isRest ? (
        <RestCard
          phase={phase}
          remainSec={restRemainSec}
          totalSec={restTotal}
          nextExercise={
            phase === "rest_between_exercises"
              ? exercises[currentExerciseIdx + 1] ?? null
              : exercises[0] ?? null
          }
          nextRound={
            phase === "rest_between_rounds" ? currentRound + 1 : currentRound
          }
          totalRounds={workout.totalRounds}
        />
      ) : (
        <CurrentExerciseCard
          exercise={currentExercise}
          elapsedSec={elapsedSec}
          phase={phase}
          overrideReps={overrideReps}
          setOverrideReps={setOverrideReps}
          overrideWeight={overrideWeight}
          setOverrideWeight={setOverrideWeight}
        />
      )}

      <div className="flex gap-2">
        {phase === "ready" ? (
          <Button
            type="button"
            size="xl"
            className="w-full"
            onClick={startWorking}
          >
            <Play className="size-5 fill-current" />
            Старт
          </Button>
        ) : null}

        {phase === "working" ? (
          <>
            <Button
              type="button"
              size="lg"
              variant={running ? "outline" : "default"}
              className="flex-1"
              onClick={running ? pauseTimer : resumeTimer}
            >
              {running ? (
                <>
                  <Pause className="size-5" />
                  Пауза
                </>
              ) : (
                <>
                  <Play className="size-5 fill-current" />
                  Продолжить
                </>
              )}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => completeCurrent(false)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Check className="size-5" />
              )}
              Готово
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => completeCurrent(true)}
              disabled={saving}
              aria-label="Пропустить"
            >
              <SkipForward className="size-5" />
            </Button>
          </>
        ) : null}

        {isRest ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={skipRest}
          >
            <SkipForward className="size-5" />
            Пропустить отдых
          </Button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={finishAll}
        >
          Завершить сейчас
        </Button>
      </div>

      <ExerciseList
        exercises={exercises}
        logIndex={logIndex}
        totalRounds={workout.totalRounds}
        currentExerciseIdx={currentExerciseIdx}
        currentRound={currentRound}
      />
    </section>
  );
}

function ProgressHeader({
  currentRound,
  totalRounds,
  currentExerciseIdx,
  exerciseCount,
  doneSlots,
  totalSlots,
}: {
  currentRound: number;
  totalRounds: number;
  currentExerciseIdx: number;
  exerciseCount: number;
  doneSlots: number;
  totalSlots: number;
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-3">
      <div className="text-muted-foreground tabular flex items-center justify-between text-[11px] uppercase tracking-wide">
        <span>
          Круг {currentRound}/{totalRounds}
        </span>
        <span>
          Упр. {Math.min(currentExerciseIdx + 1, exerciseCount)}/{exerciseCount}
        </span>
        <span>
          Сделано {doneSlots}/{totalSlots}
        </span>
      </div>
    </div>
  );
}

function CurrentExerciseCard({
  exercise,
  elapsedSec,
  phase,
  overrideReps,
  setOverrideReps,
  overrideWeight,
  setOverrideWeight,
}: {
  exercise: CircuitExerciseWithName | null;
  elapsedSec: number;
  phase: Phase;
  overrideReps: string;
  setOverrideReps: (v: string) => void;
  overrideWeight: string;
  setOverrideWeight: (v: string) => void;
}) {
  if (!exercise) return null;

  const isReps = exercise.kind === "reps";
  const target =
    isReps && exercise.targetReps
      ? `${exercise.targetReps} повт.`
      : !isReps && exercise.targetDurationSec
        ? `${exercise.targetDurationSec} сек`
        : "—";

  return (
    <div className="bg-primary text-primary-foreground border-primary rounded-2xl border p-6 text-center">
      <p className="text-[10px] font-medium tracking-[0.2em] uppercase opacity-70">
        Текущее упражнение
      </p>
      <h2 className="font-serif mt-1 text-2xl font-normal tracking-tight md:text-3xl">
        {exercise.exerciseNameRu}
      </h2>
      <p className="tabular mt-1 text-sm opacity-80">Цель: {target}</p>

      <div className="font-serif tabular mt-4 text-6xl font-normal tracking-tighter md:text-7xl">
        {isReps && phase !== "working"
          ? exercise.targetReps ?? "—"
          : formatMmSs(elapsedSec)}
      </div>
      {!isReps ? (
        <p className="tabular mt-1 text-xs opacity-60">
          {phase === "working" ? "идёт" : "готовы к старту"}
        </p>
      ) : null}

      {phase === "working" ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isReps ? (
            <label className="text-primary-foreground/90 block text-left">
              <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
                Сделано (повт., опц.)
              </span>
              <NumberField
                value={overrideReps}
                onChange={setOverrideReps}
                placeholder={String(exercise.targetReps ?? "")}
                className="tabular bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30 placeholder:text-primary-foreground/50 mt-1 h-9 text-center"
              />
            </label>
          ) : null}
          <label className="text-primary-foreground/90 block text-left">
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
              Вес (кг, опц.)
            </span>
            <NumberField
              decimal
              value={overrideWeight}
              onChange={setOverrideWeight}
              placeholder={
                exercise.targetWeightKg != null
                  ? String(exercise.targetWeightKg)
                  : "—"
              }
              className="tabular bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30 placeholder:text-primary-foreground/50 mt-1 h-9 text-center"
            />
          </label>
        </div>
      ) : null}

      {exercise.notes ? (
        <p className="mt-3 text-xs opacity-80">{exercise.notes}</p>
      ) : null}
    </div>
  );
}

function RestCard({
  phase,
  remainSec,
  totalSec,
  nextExercise,
  nextRound,
  totalRounds,
}: {
  phase: Phase;
  remainSec: number;
  totalSec: number;
  nextExercise: CircuitExerciseWithName | null;
  nextRound: number;
  totalRounds: number;
}) {
  const progress = totalSec > 0 ? 1 - remainSec / totalSec : 1;
  const isRound = phase === "rest_between_rounds";

  return (
    <div className="bg-card text-card-foreground border-border relative overflow-hidden rounded-2xl border p-8 text-center">
      <div
        aria-hidden
        className="bg-primary/15 absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      <div className="relative">
        <p className="text-[10px] font-medium tracking-[0.2em] uppercase opacity-70">
          {isRound ? "Отдых между кругами" : "Отдых перед след. упражнением"}
        </p>
        <p className="font-serif tabular mt-2 text-7xl font-normal tracking-tighter md:text-8xl">
          {formatMmSs(remainSec)}
        </p>
        {nextExercise ? (
          <p className="text-muted-foreground tabular mt-2 text-sm">
            Дальше: <b className="text-foreground">{nextExercise.exerciseNameRu}</b>
            {isRound ? ` · круг ${nextRound}/${totalRounds}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ExerciseList({
  exercises,
  logIndex,
  totalRounds,
  currentExerciseIdx,
  currentRound,
}: {
  exercises: CircuitExerciseWithName[];
  logIndex: Map<string, CircuitRoundLog>;
  totalRounds: number;
  currentExerciseIdx: number;
  currentRound: number;
}) {
  return (
    <details className="bg-card border-border rounded-2xl border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Все упражнения ({exercises.length})
      </summary>
      <ul className="tabular mt-3 space-y-2 text-xs">
        {exercises.map((ex, i) => {
          const active = i === currentExerciseIdx;
          const rounds: number[] = [];
          for (let r = 1; r <= totalRounds; r++) rounds.push(r);
          return (
            <li
              key={ex.id}
              className={cn(
                "rounded px-2 py-2",
                active && "bg-primary/10 text-primary",
              )}
            >
              <p className="font-medium">
                {i + 1}. {ex.exerciseNameRu}{" "}
                <span className="text-muted-foreground font-normal">
                  · {ex.kind === "reps" ? `${ex.targetReps ?? "?"} повт.` : `${ex.targetDurationSec ?? "?"} сек`}
                  {ex.targetWeightKg != null ? ` · ${ex.targetWeightKg} кг` : ""}
                </span>
              </p>
              <div className="text-muted-foreground mt-1 flex flex-wrap gap-1">
                {rounds.map((r) => {
                  const log = logIndex.get(`${ex.id}:${r}`);
                  const cur = active && r === currentRound;
                  return (
                    <span
                      key={r}
                      className={cn(
                        "tabular inline-flex size-6 items-center justify-center rounded-md text-[10px] font-medium",
                        log
                          ? log.skipped
                            ? "bg-warning/20 text-warning"
                            : "bg-success/20 text-success"
                          : "bg-muted",
                        cur && "ring-primary ring-2",
                      )}
                      title={
                        log
                          ? log.skipped
                            ? "Пропущен"
                            : "Сделан"
                          : `Круг ${r}`
                      }
                    >
                      {r}
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function findFirstIncomplete(
  exercises: CircuitExerciseWithName[],
  totalRounds: number,
  logIndex: Map<string, CircuitRoundLog>,
): { round: number; exerciseIdx: number; done: boolean } {
  for (let r = 1; r <= totalRounds; r++) {
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i]!;
      if (!logIndex.has(`${ex.id}:${r}`)) {
        return { round: r, exerciseIdx: i, done: false };
      }
    }
  }
  return { round: totalRounds, exerciseIdx: Math.max(0, exercises.length - 1), done: true };
}

function formatMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
