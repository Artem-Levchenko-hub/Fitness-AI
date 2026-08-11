import type {
  StrengthMovement,
  StrengthRecord,
} from "@/db/schema/strength-records";

export type StrengthMovementDefinition = {
  key: StrengthMovement;
  title: string;
  shortTitle: string;
  description: string;
  unit: "повт." | "кг";
  inputLabel: string;
  inputHint: string;
  min: number;
  max: number;
  step: number;
  decimal: boolean;
};

export const STRENGTH_MOVEMENT_DEFINITIONS: readonly StrengthMovementDefinition[] =
  [
    {
      key: "pull_up",
      title: "Подтягивания",
      shortTitle: "Подтягивания",
      description:
        "Максимум за один подход: из полного виса до подбородка выше перекладины, без раскачки и помощи ног.",
      unit: "повт.",
      inputLabel: "Повторения",
      inputHint: "Например, 12",
      min: 1,
      max: 200,
      step: 1,
      decimal: false,
    },
    {
      key: "back_squat",
      title: "Приседания со штангой",
      shortTitle: "Присед",
      description:
        "Лучший одиночный повтор: таз ниже верха колена, стопы не отрываются, вверху полное выпрямление.",
      unit: "кг",
      inputLabel: "Вес штанги",
      inputHint: "Например, 100",
      min: 1,
      max: 1000,
      step: 0.5,
      decimal: true,
    },
    {
      key: "bench_press",
      title: "Жим лёжа",
      shortTitle: "Жим лёжа",
      description:
        "Лучший одиночный повтор: лопатки и таз на скамье, касание груди и полное выпрямление рук.",
      unit: "кг",
      inputLabel: "Вес штанги",
      inputHint: "Например, 80",
      min: 1,
      max: 1000,
      step: 0.5,
      decimal: true,
    },
  ];

export type StrengthRecordSummary = {
  personalBest: StrengthRecord | null;
  latest: StrengthRecord | null;
  history: StrengthRecord[];
};

export function summarizeStrengthRecords(
  records: readonly StrengthRecord[],
): Record<StrengthMovement, StrengthRecordSummary> {
  const result: Record<StrengthMovement, StrengthRecordSummary> = {
    pull_up: { personalBest: null, latest: null, history: [] },
    back_squat: { personalBest: null, latest: null, history: [] },
    bench_press: { personalBest: null, latest: null, history: [] },
  };

  for (const record of records) {
    const summary = result[record.movement];
    summary.history.push(record);
    if (
      summary.latest == null ||
      record.performedAt > summary.latest.performedAt ||
      (record.performedAt === summary.latest.performedAt &&
        record.createdAt > summary.latest.createdAt)
    ) {
      summary.latest = record;
    }
    if (
      summary.personalBest == null ||
      record.value > summary.personalBest.value
    ) {
      summary.personalBest = record;
    }
  }

  for (const summary of Object.values(result)) {
    summary.history.sort(
      (a, b) =>
        b.performedAt.localeCompare(a.performedAt) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  return result;
}

export function formatStrengthValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
