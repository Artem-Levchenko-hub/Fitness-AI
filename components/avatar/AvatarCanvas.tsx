"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { PlaceholderBody } from "./PlaceholderBody";
import type { AvatarMuscleDatum } from "./types";

/** Client-only WebGL-сцена аватара. Загружается через next/dynamic ssr:false
 *  (см. ProfileAvatar) — three.js не идёт в server-бандл и не ломает гидрацию.
 *
 *  Перф (CLAUDE.md крит #7): frameloop="demand" — кадр рендерится только при
 *  смене данных или вращении (OrbitControls drei сам зовёт invalidate на
 *  change). idle = 0 GPU. Без bloom-постобработки — свечение фейкается через
 *  emissive материала. Damping выключен: в demand-режиме инерция требует
 *  непрерывных кадров, а одиночный invalidate на drag отзывчив и без неё. */

type Props = {
  data: AvatarMuscleDatum[];
  selected: string | null;
  onSelect: (key: string | null) => void;
};

export default function AvatarCanvas({ data, selected, onSelect }: Props) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 0.1, 2.9], fov: 38 }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.15} />
      <directionalLight position={[-3, 1, -3]} intensity={0.45} />

      <PlaceholderBody data={data} selected={selected} onSelect={onSelect} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping={false}
        minDistance={1.7}
        maxDistance={5}
        target={[0, 0.05, 0]}
      />
    </Canvas>
  );
}
