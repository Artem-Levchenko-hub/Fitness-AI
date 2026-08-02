"use client";

import { ChevronDown, Snowflake } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, useSyncExternalStore } from "react";

import { MUSCLE_MODEL_URL } from "@/lib/avatar/model-config";
import { forgottenLabel } from "@/lib/domain/avatar/forgotten";
import { hottestMuscleKey } from "@/lib/domain/avatar/hottest";

import { MuscleLegend } from "./MuscleLegend";
import { CYCLE_LEN, MuscleInfoPanel } from "./MuscleInfoPanel";
import type { AvatarMuscleDatum } from "./types";

/** Публичная обёртка 3D-аватара. Держит состояние выбора + цикла тапа, лениво
 *  грузит WebGL-сцену (ssr:false — обязательно из Client Component, Next 16),
 *  и деградирует в список при отсутствии WebGL. Используется и на своём
 *  /profile, и на профиле друга (read-only — тот же компонент, данные друга). */

const AvatarCanvas = dynamic(() => import("./AvatarCanvas"), {
  ssr: false,
  loading: () => <CanvasSkeleton />,
});

export function ProfileAvatar({
  data,
  linkExercises = false,
  initialMuscle = null,
  editableGoals = false,
}: {
  data: AvatarMuscleDatum[];
  /** Делать упражнения в панели мышцы ссылками на их историю /exercises/[id].
   *  Только свой /profile — профиль друга показал бы историю смотрящего. */
  linkExercises?: boolean;
  /** H17.0 — глубокий линк `/profile?muscle=<key>` сразу открывает панель этой
   *  группы (вход из разбора в тело). Уже провалидирован сервером
   *  (parseMuscleParam); неизвестная группа → панель закрыта (data.find промах). */
  initialMuscle?: string | null;
  /** H18.2 — разрешить постановку/снятие цели частоты в панели мышцы. Только
   *  свой /profile (default false): на профиле друга цель не правим. */
  editableGoals?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(initialMuscle);
  const [cycle, setCycle] = useState(0);
  // Поддержка WebGL — внешнее (браузерное) состояние, читаем через
  // useSyncExternalStore: на сервере считаем поддержку (canvas всё равно
  // ssr:false), на клиенте — реальная проба. Без cascading-render в effect.
  const webgl = useWebGL();
  // H6.5: одноразовый аффорданс «тапни мышцу». tappedBefore — persistent
  // localStorage-флаг (server snapshot=true → нет hydration-вспышки и нет
  // подсказки тем, кто уже тапал). Подсказка + микро-пульс самой горячей группы
  // видны ТОЛЬКО до первого тапа в жизни и пока ничего не выбрано.
  const tappedBefore = useTappedBefore();
  const hottestKey = useMemo(() => hottestMuscleKey(data), [data]);
  const showAffordance = !tappedBefore && selected === null;
  const pulseKey = showAffordance ? hottestKey : null;

  const onSelect = (key: string | null) => {
    if (key === null) {
      setSelected(null);
      return;
    }
    markTapped(); // первый тап гасит подсказку навсегда (persist)
    if (key === selected) {
      setCycle((c) => (c + 1) % CYCLE_LEN);
    } else {
      setSelected(key);
      setCycle(0);
    }
  };

  const selectedDatum = selected
    ? (data.find((d) => d.key === selected) ?? null)
    : null;

  return (
    <div className="space-y-3">
      <div className="bg-card/40 border-border relative aspect-[3/4] w-full overflow-hidden rounded-3xl border">
        {webgl ? (
          <AvatarCanvas data={data} selected={selected} onSelect={onSelect} />
        ) : (
          <MuscleListFallback
            data={data}
            selected={selected}
            onSelect={onSelect}
          />
        )}
        {showAffordance ? (
          <div
            data-avatar-hint="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3"
          >
            <span className="bg-foreground/85 text-background flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg">
              <span
                className="bg-background/90 size-2 rounded-full motion-safe:animate-ping"
                aria-hidden="true"
              />
              Тапни мышцу — откроется её история
            </span>
          </div>
        ) : null}
      </div>

      <MuscleInfoPanel
        datum={selectedDatum}
        cycle={cycle}
        onAdvance={() => selected && onSelect(selected)}
        onClose={() => onSelect(null)}
        linkExercises={linkExercises}
        editableGoals={editableGoals}
      />

      {/* Легенда-чипы по нагреву свёрнута по умолчанию — громоздкий раздел не
          давит на экран; раскрывается одним тапом (native <details> —
          keyboard-доступно R-39, ноль доп. состояния R-01). */}
      <details className="group border-border bg-card/40 rounded-2xl border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>Все группы мышц по нагреву</span>
          <ChevronDown
            className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="px-4 pb-4">
          <MuscleLegend
            data={data}
            selected={selected}
            onSelect={onSelect}
            pulseKey={pulseKey}
          />
        </div>
      </details>

      {/* Атрибуция CC BY-SA 4.0 — обязательна при использовании Z-Anatomy. */}
      {MUSCLE_MODEL_URL ? (
        <p className="text-muted-foreground text-center text-[10px]">
          3D-модель на основе{" "}
          <a
            href="https://sketchfab.com/3d-models/myology-31b40fd809b14665b93773936d67c52c"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            «Myology»
          </a>{" "}
          by Z-Anatomy · CC BY-SA 4.0
        </p>
      ) : null}
    </div>
  );
}

function CanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="border-muted-foreground/30 border-t-foreground/70 size-8 animate-spin rounded-full border-2" />
      <span className="sr-only">Загрузка 3D-модели…</span>
    </div>
  );
}

/** Деградация без WebGL: тот же контракт (цвет/выбор/тап), но списком. Также
 *  доступная (keyboard-friendly) альтернатива 3D. */
function MuscleListFallback({
  data,
  selected,
  onSelect,
}: {
  data: AvatarMuscleDatum[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <ul className="h-full w-full space-y-1 overflow-y-auto p-3">
      {data.map((d) => (
        <li key={d.key}>
          <button
            type="button"
            onClick={() => onSelect(d.key)}
            aria-pressed={selected === d.key}
            className="hover:bg-muted/60 aria-pressed:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors"
          >
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden="true"
            />
            <span className="flex-1">{d.label}</span>
            {d.forgottenWeeks != null ? (
              <span
                className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                title={forgottenLabel(d.forgottenWeeks)}
              >
                <Snowflake className="size-3.5 shrink-0" aria-hidden="true" />
                {forgottenLabel(d.forgottenWeeks)}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">
                {d.levelLabel}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** H6.5 — «тапал ли юзер мышцу хоть раз». Persistent localStorage-флаг как
 *  внешнее браузерное состояние через useSyncExternalStore: серверный снапшот =
 *  true (подсказка скрыта при SSR → нет hydration-вспышки и нет подсказки тем,
 *  кто уже знает жест), клиентский — реальное чтение localStorage. markTapped
 *  эмитит подписчикам, поэтому повторное снятие выбора не воскрешает подсказку. */
const TAP_KEY = "avatar:first-tap";
let tappedCache: boolean | null = null;
const tapListeners = new Set<() => void>();

function readTapped(): boolean {
  try {
    return localStorage.getItem(TAP_KEY) === "1";
  } catch {
    return true; // нет localStorage (приватный режим) → не навязываем подсказку
  }
}

function getTappedSnapshot(): boolean {
  if (tappedCache === null) tappedCache = readTapped();
  return tappedCache;
}

function subscribeTapped(listener: () => void): () => void {
  tapListeners.add(listener);
  return () => tapListeners.delete(listener);
}

function markTapped(): void {
  if (tappedCache === true) return;
  tappedCache = true;
  try {
    localStorage.setItem(TAP_KEY, "1");
  } catch {
    /* приватный режим — подсказка просто не запомнится между перезагрузками */
  }
  tapListeners.forEach((l) => l());
}

function useTappedBefore(): boolean {
  return useSyncExternalStore(subscribeTapped, getTappedSnapshot, () => true);
}

/** Поддержка WebGL как внешнее браузерное состояние (не меняется в рамках
 *  сессии). Серверный снапшот = true (canvas всё равно ssr:false), клиентский —
 *  реальная проба, кэшированная на модуль. */
function useWebGL(): boolean {
  return useSyncExternalStore(subscribeNoop, getWebGLSnapshot, () => true);
}

const subscribeNoop = () => () => {};

let webglCache: boolean | null = null;
function getWebGLSnapshot(): boolean {
  if (webglCache === null) webglCache = detectWebGL();
  return webglCache;
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}
