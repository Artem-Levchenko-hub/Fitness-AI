"use client";

import { Snowflake } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

import { MUSCLE_MODEL_URL } from "@/lib/avatar/model-config";
import { forgottenLabel } from "@/lib/domain/avatar/forgotten";

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
}: {
  data: AvatarMuscleDatum[];
  /** Делать упражнения в панели мышцы ссылками на их историю /exercises/[id].
   *  Только свой /profile — профиль друга показал бы историю смотрящего. */
  linkExercises?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  // Поддержка WebGL — внешнее (браузерное) состояние, читаем через
  // useSyncExternalStore: на сервере считаем поддержку (canvas всё равно
  // ssr:false), на клиенте — реальная проба. Без cascading-render в effect.
  const webgl = useWebGL();

  const onSelect = (key: string | null) => {
    if (key === null) {
      setSelected(null);
      return;
    }
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
      </div>

      <MuscleInfoPanel
        datum={selectedDatum}
        cycle={cycle}
        onAdvance={() => selected && onSelect(selected)}
        onClose={() => onSelect(null)}
        linkExercises={linkExercises}
      />

      <MuscleLegend data={data} selected={selected} onSelect={onSelect} />

      {/* Атрибуция CC BY-SA 4.0 — обязательна при использовании Z-Anatomy. */}
      {MUSCLE_MODEL_URL ? (
        <p className="text-muted-foreground/60 text-center text-[10px]">
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
