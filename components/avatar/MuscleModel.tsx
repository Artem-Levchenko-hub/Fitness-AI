"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import { resolveMuscleKey } from "@/lib/avatar/muscle-mesh-map";

import type { AvatarMuscleDatum } from "./types";

/** Рендер РЕАЛЬНОЙ анатомической glb-модели (Z-Anatomy Myology и т.п.). Тот же
 *  контракт, что у <PlaceholderBody>: меши помечаются muscleKey, красятся из
 *  data, тап → onSelect. Имена мешей сводятся к 14 группам резолвером
 *  (resolveMuscleKey, юнит-тестируется). Меши без соответствия — нейтральные и
 *  не выбираются.
 *
 *  Включается через MUSCLE_MODEL_URL (lib/avatar/model-config). Грузится под
 *  <Suspense> (см. AvatarCanvas). До появления glb компонент не рендерится —
 *  верифицировать на реальном файле в preview-harness перед включением флага. */

const NEUTRAL = "#7a7a72";

type Props = {
  url: string;
  data: AvatarMuscleDatum[];
  selected: string | null;
  onSelect: (key: string | null) => void;
};

export function MuscleModel({ url, data, selected, onSelect }: Props) {
  const { scene } = useGLTF(url);

  // Клонируем сцену и даём каждому мешу свой материал + кэшируем muscleKey в
  // userData (резолвим один раз, не на каждый кадр).
  const root = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((obj: Object3D) => {
      if (obj instanceof Mesh) {
        obj.userData.muscleKey = resolveMuscleKey(obj.name);
        obj.material = new MeshStandardMaterial({
          color: NEUTRAL,
          roughness: 0.55,
          metalness: 0.05,
        });
      }
    });
    return cloned;
  }, [scene]);

  // Перекрашиваем при смене data/selected (без пересоздания геометрии).
  useLayoutEffect(() => {
    const byKey = new Map(data.map((d) => [d.key, d]));
    root.traverse((obj: Object3D) => {
      if (!(obj instanceof Mesh)) return;
      const key = obj.userData.muscleKey as string | null;
      const datum = key ? byKey.get(key) : undefined;
      const hex = datum?.color ?? NEUTRAL;
      const t = datum?.t ?? 0;
      const isSelected = key != null && key === selected;
      const mat = obj.material as MeshStandardMaterial;
      mat.color.set(new Color(hex));
      mat.emissive.set(new Color(hex));
      mat.emissiveIntensity = (isSelected ? 0.85 : 0.25) + t * 0.75;
    });
  }, [root, data, selected]);

  return (
    <primitive
      object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        const key = e.object.userData.muscleKey as string | null;
        if (key) {
          e.stopPropagation();
          onSelect(key);
        }
      }}
    />
  );
}
