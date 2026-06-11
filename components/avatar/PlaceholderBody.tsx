"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { AvatarMuscleDatum } from "./types";

/** ВРЕМЕННАЯ модель тела для 3D-аватара: 14 групп мышц как примитивы,
 *  расставленные в узнаваемую фигуру. Билатеральные группы (руки/ноги/дельты)
 *  зеркалятся по X и красятся одним цветом — это одна группа.
 *
 *  «Шов модели»: этот компонент и будущий <MuscleModel> (useGLTF реальной
 *  Z-Anatomy) реализуют ОДИН контракт — рендер мешей, помеченных muscleKey,
 *  с цветом из data и кликом → onSelect. Замена placeholder на glb не трогает
 *  раскраску/тап/вращение. См. спек, Slice 4. */

type GeoType = "box" | "capsule" | "sphere";

type Segment = {
  key: string;
  geo: { type: GeoType; args: number[] };
  pos: [number, number, number];
  /** Также отрисовать зеркально по X (билатеральная группа). */
  mirror?: boolean;
};

// Фигура центрирована вокруг 0 по Y (голова ~+0.95, стопы ~-0.9). +Z — перёд.
// Мышцы спины (широчайшие, трапеция, задние дельты, ягодицы, бицепс бедра,
// икры) уходят в -Z — видно при повороте модели.
const SEGMENTS: Segment[] = [
  { key: "back_traps", geo: { type: "box", args: [0.34, 0.16, 0.16] }, pos: [0, 0.66, -0.04] },
  { key: "chest", geo: { type: "box", args: [0.46, 0.26, 0.18] }, pos: [0, 0.55, 0.1] },
  { key: "shoulders_front", geo: { type: "sphere", args: [0.1, 16, 16] }, pos: [0.32, 0.62, 0.07], mirror: true },
  { key: "shoulders_side", geo: { type: "sphere", args: [0.1, 16, 16] }, pos: [0.4, 0.6, 0], mirror: true },
  { key: "shoulders_rear", geo: { type: "sphere", args: [0.1, 16, 16] }, pos: [0.32, 0.62, -0.07], mirror: true },
  { key: "back_lats", geo: { type: "box", args: [0.16, 0.34, 0.14] }, pos: [0.2, 0.4, -0.06], mirror: true },
  { key: "core", geo: { type: "box", args: [0.36, 0.4, 0.16] }, pos: [0, 0.25, 0.08] },
  { key: "biceps", geo: { type: "capsule", args: [0.07, 0.22, 4, 12] }, pos: [0.46, 0.42, 0.05], mirror: true },
  { key: "triceps", geo: { type: "capsule", args: [0.07, 0.22, 4, 12] }, pos: [0.46, 0.42, -0.05], mirror: true },
  { key: "forearms", geo: { type: "capsule", args: [0.06, 0.24, 4, 12] }, pos: [0.5, 0.12, 0], mirror: true },
  { key: "glutes", geo: { type: "box", args: [0.4, 0.22, 0.2] }, pos: [0, 0, -0.06] },
  { key: "quads", geo: { type: "capsule", args: [0.1, 0.34, 4, 12] }, pos: [0.16, -0.3, 0.05], mirror: true },
  { key: "hamstrings", geo: { type: "capsule", args: [0.1, 0.34, 4, 12] }, pos: [0.16, -0.3, -0.05], mirror: true },
  { key: "calves", geo: { type: "capsule", args: [0.08, 0.28, 4, 12] }, pos: [0.16, -0.72, -0.02], mirror: true },
];

const NEUTRAL = "#7a7a72";

type Props = {
  data: AvatarMuscleDatum[];
  selected: string | null;
  onSelect: (key: string) => void;
};

export function PlaceholderBody({ data, selected, onSelect }: Props) {
  const byKey = useMemo(
    () => new Map(data.map((d) => [d.key, d])),
    [data],
  );

  const setCursor = (v: string) => {
    if (typeof document !== "undefined") document.body.style.cursor = v;
  };

  return (
    <group>
      {/* Голова — декоративная, нейтральная, не кликается. */}
      <mesh position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={NEUTRAL} roughness={0.9} />
      </mesh>

      {SEGMENTS.flatMap((seg) => {
        const datum = byKey.get(seg.key);
        const color = datum?.color ?? NEUTRAL;
        const t = datum?.t ?? 0;
        const isSelected = selected === seg.key;
        // Свечение: базовый emissive растёт с нагревом; выбранная группа ярче.
        const emissiveIntensity = (isSelected ? 0.85 : 0.25) + t * 0.75;

        const positions: Array<[number, number, number]> = seg.mirror
          ? [seg.pos, [-seg.pos[0], seg.pos[1], seg.pos[2]]]
          : [seg.pos];

        return positions.map((pos, i) => (
          <mesh
            key={`${seg.key}-${i}`}
            position={pos}
            scale={isSelected ? 1.08 : 1}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(seg.key);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setCursor("pointer");
            }}
            onPointerOut={() => setCursor("auto")}
          >
            {seg.geo.type === "box" && <boxGeometry args={seg.geo.args as [number, number, number]} />}
            {seg.geo.type === "capsule" && <capsuleGeometry args={seg.geo.args as [number, number, number, number]} />}
            {seg.geo.type === "sphere" && <sphereGeometry args={seg.geo.args as [number, number, number]} />}
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
              roughness={0.55}
              metalness={0.05}
            />
          </mesh>
        ));
      })}
    </group>
  );
}
