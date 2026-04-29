import { Badge } from "@/components/ui/badge";

const MUSCLE_LABELS_RU: Record<string, string> = {
  chest: "Грудь",
  back_lats: "Широчайшие",
  back_traps: "Трапеция",
  shoulders_front: "Дельты перед.",
  shoulders_side: "Дельты сред.",
  shoulders_rear: "Дельты задн.",
  biceps: "Бицепс",
  triceps: "Трицепс",
  forearms: "Предплечья",
  core: "Кор",
  glutes: "Ягодицы",
  quads: "Квадрицепс",
  hamstrings: "Бицепс бедра",
  calves: "Икры",
};

export function muscleLabel(key: string): string {
  return MUSCLE_LABELS_RU[key] ?? key;
}

export function MuscleBadges({
  primary,
  secondary,
}: {
  primary: ReadonlyArray<string>;
  secondary?: ReadonlyArray<string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {primary.map((key) => (
        <Badge key={`p-${key}`} variant="default" className="text-[11px]">
          {muscleLabel(key)}
        </Badge>
      ))}
      {(secondary ?? []).map((key) => (
        <Badge key={`s-${key}`} variant="secondary" className="text-[11px]">
          {muscleLabel(key)}
        </Badge>
      ))}
    </div>
  );
}
