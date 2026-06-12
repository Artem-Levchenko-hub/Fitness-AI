"use client";

import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
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

  // Клонируем сцену, даём каждому мешу свой материал + кэшируем muscleKey, и
  // вписываем модель в кадр: центрируем по X/Z, ставим стопы около низа и
  // масштабируем под целевую высоту — чтобы реальная модель (ноги y=0,
  // голова y~1.7) кадрировалась так же, как процедурный placeholder.
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

    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const TARGET_HEIGHT = 1.85;
    const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;

    const fitted = new Group();
    cloned.position.set(-center.x, -center.y, -center.z); // центр модели → 0
    fitted.add(cloned);
    fitted.scale.setScalar(scale);
    // glb из build-avatar-glb.mjs ориентирован передом в +Z; камера на +Z →
    // перёд смотрит в камеру на покое без доворота (подтверждено рендером).
    return fitted;
  }, [scene]);

  // Перекрашиваем при смене data/selected (без пересоздания геометрии). Когда
  // что-то выбрано — выбранная мышца ЯРКО горит, остальные гаснут (тускнеют),
  // чтобы выбранная не сливалась с соседями (напр. бицепс бедра рядом с
  // ягодицами/икрами).
  useLayoutEffect(() => {
    const byKey = new Map(data.map((d) => [d.key, d]));
    const hasSelection = selected != null;
    root.traverse((obj: Object3D) => {
      if (!(obj instanceof Mesh)) return;
      const key = obj.userData.muscleKey as string | null;
      const datum = key ? byKey.get(key) : undefined;
      const hex = datum?.color ?? NEUTRAL;
      const t = datum?.t ?? 0;
      const isSelected = key != null && key === selected;
      const mat = obj.material as MeshStandardMaterial;
      // «Забытая» группа (≥2 недель без нагрузки) — каркасом, а не сплошной
      // заливкой: отличима не только цветом (R-41), читается как «полая/забытая».
      mat.wireframe = (datum?.forgottenWeeks ?? null) != null;
      const col = new Color(hex);
      const emi = new Color(hex);
      let intensity: number;
      if (isSelected) {
        col.multiplyScalar(1.12); // выбранная — чуть ярче основа
        intensity = 1.25 + t * 0.5; // сильное свечение
      } else if (hasSelection) {
        col.multiplyScalar(0.32); // невыбранные — притушить
        emi.multiplyScalar(0.32);
        intensity = 0.05;
      } else {
        intensity = 0.25 + t * 0.75; // обычный режим (нет выбора)
      }
      mat.color.copy(col);
      mat.emissive.copy(emi);
      mat.emissiveIntensity = intensity;
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
