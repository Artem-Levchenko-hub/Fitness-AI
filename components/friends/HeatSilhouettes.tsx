"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import { muscleLabelRu, type MuscleKey } from "@/lib/domain/avatar/heat";
import {
  selectFriendGroupAggregate,
  type FriendGroupAggregate,
  type FriendGroupDatum,
} from "@/lib/domain/friends/friend-group-aggregate";

/** H3.5 (sub-slice B) — интерактив двух heat-силуэтов сравнения. Силуэт
 *  визуально-агностичен (H9.2 BodySilhouette), клик-логику несёт onMuscle:
 *  - МОЙ силуэт → /profile?muscle=<key> (вход в свою историю группы, reuse
 *    H17.0-B как BalanceSilhouette.tsx:28).
 *  - силуэт ДРУГА → read-only сводка его группы инлайн (вход в данные, столп 2),
 *    БЕЗ навигации/ссылок на упражнения (R-7). Данные друга — уже за areFriends-
 *    гейтом страницы. */
export function HeatSilhouettes({
  myColors,
  theirColors,
  theirData,
  friendName,
}: {
  myColors: Record<string, string>;
  theirColors: Record<string, string>;
  theirData: FriendGroupDatum[];
  friendName: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<MuscleKey | null>(null);
  const aggregate = selected
    ? selectFriendGroupAggregate(theirData, selected)
    : null;

  return (
    <div className="bg-card/40 border-border rounded-2xl border p-4">
      <div className="grid grid-cols-2 gap-3">
        <SilhouetteCell
          colors={myColors}
          caption="Вы"
          ariaLabel="Ваша нагрузка по группам мышц за неделю. Тап по группе — её история"
          onMuscle={(key) => router.push(`/profile?muscle=${key}`)}
        />
        <SilhouetteCell
          colors={theirColors}
          caption={friendName}
          ariaLabel={`Нагрузка ${friendName} по группам мышц за неделю. Тап по группе — её сводка`}
          onMuscle={setSelected}
        />
      </div>

      {selected ? (
        aggregate ? (
          <FriendGroupPanel aggregate={aggregate} />
        ) : (
          <p className="text-muted-foreground mt-3 text-center text-xs">
            {muscleLabelRu(selected)}: нет нагрузки за неделю
          </p>
        )
      ) : (
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Тап по группе: своя — её история, у друга — сводка
        </p>
      )}
    </div>
  );
}

function SilhouetteCell({
  colors,
  caption,
  ariaLabel,
  onMuscle,
}: {
  colors: Record<string, string>;
  caption: string;
  ariaLabel: string;
  onMuscle: (key: MuscleKey) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <BodySilhouette
        ariaLabel={ariaLabel}
        className="h-24 w-full"
        shapeFill={(key) => ({ fill: colors[key] })}
        onMuscle={onMuscle}
      />
      <p className="text-muted-foreground max-w-full truncate text-center text-xs font-medium">
        {caption}
      </p>
    </div>
  );
}

/** Read-only сводка группы друга: имя · уровень · подходы · тоннаж за неделю.
 *  Ноль ссылок/упражнений (R-7) — только агрегат. */
function FriendGroupPanel({ aggregate }: { aggregate: FriendGroupAggregate }) {
  return (
    <div className="border-border mt-3 rounded-xl border border-dashed p-3">
      <p className="text-sm font-semibold tracking-tight">{aggregate.label}</p>
      <dl className="text-muted-foreground tabular mt-2 grid grid-cols-3 gap-2 text-xs">
        <Stat label="уровень" value={aggregate.levelLabel} />
        <Stat label="подходов" value={String(aggregate.sets)} />
        <Stat
          label="кг·повт"
          value={Math.round(aggregate.volume7d).toLocaleString("ru-RU")}
        />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground text-sm font-semibold">{value}</p>
      <p className="mt-0.5">{label}</p>
    </div>
  );
}
