export type CardioPresetKind =
  | "tabata"
  | "norwegian_4x4"
  | "emom"
  | "custom";

export type PlannedBlock = {
  kind: "work" | "rest";
  label: string;
  durationSec: number;
};

export type CustomParams = {
  rounds: number;
  workSec: number;
  restSec: number;
};

/** Метаданные для preset-picker'а (UI). */
export type PresetMeta = {
  kind: CardioPresetKind;
  nameRu: string;
  subtitleRu: string;
  totalSec: number;
  defaultName: string;
};

export const PRESET_META: Record<
  Exclude<CardioPresetKind, "custom">,
  PresetMeta
> = {
  tabata: {
    kind: "tabata",
    nameRu: "Tabata",
    subtitleRu: "8 раундов · 20 сек работа / 10 сек отдых",
    totalSec: 4 * 60,
    defaultName: "Tabata",
  },
  norwegian_4x4: {
    kind: "norwegian_4x4",
    nameRu: "Норвежский 4×4",
    subtitleRu: "4 раунда · 4 мин 90-95% / 3 мин восстановление",
    totalSec: 4 * (4 * 60 + 3 * 60),
    defaultName: "Норвежский 4×4",
  },
  emom: {
    kind: "emom",
    nameRu: "EMOM 10 мин",
    subtitleRu: "10 раундов · 1 мин работа подряд (без отдыха)",
    totalSec: 10 * 60,
    defaultName: "EMOM 10",
  },
};

/** Конвертирует preset (с опциональными параметрами для custom/emom) в
 *  список блоков в порядке выполнения. */
export function presetToBlocks(
  preset: CardioPresetKind,
  params?: Partial<CustomParams> & { emomRounds?: number },
): PlannedBlock[] {
  switch (preset) {
    case "tabata":
      return repeat(8, [
        { kind: "work", label: "Работа", durationSec: 20 },
        { kind: "rest", label: "Отдых", durationSec: 10 },
      ]);
    case "norwegian_4x4":
      return repeat(4, [
        { kind: "work", label: "Работа 90-95%", durationSec: 4 * 60 },
        { kind: "rest", label: "Восстановление", durationSec: 3 * 60 },
      ]);
    case "emom": {
      const rounds = params?.emomRounds ?? 10;
      return Array.from({ length: rounds }, (_, i) => ({
        kind: "work" as const,
        label: `Минута ${i + 1}`,
        durationSec: 60,
      }));
    }
    case "custom": {
      const rounds = params?.rounds ?? 6;
      const workSec = params?.workSec ?? 30;
      const restSec = params?.restSec ?? 60;
      const blocks: PlannedBlock[] = [];
      for (let i = 0; i < rounds; i += 1) {
        blocks.push({
          kind: "work",
          label: `Работа · раунд ${i + 1}`,
          durationSec: workSec,
        });
        if (restSec > 0 && i < rounds - 1) {
          blocks.push({
            kind: "rest",
            label: `Отдых · после раунда ${i + 1}`,
            durationSec: restSec,
          });
        }
      }
      return blocks;
    }
  }
}

function repeat(n: number, pattern: PlannedBlock[]): PlannedBlock[] {
  const out: PlannedBlock[] = [];
  for (let i = 0; i < n; i += 1) {
    for (const b of pattern) {
      out.push({
        ...b,
        label: pattern.length > 1 ? `${b.label} · раунд ${i + 1}` : b.label,
      });
    }
  }
  return out;
}

export function totalPlannedSec(blocks: ReadonlyArray<PlannedBlock>): number {
  return blocks.reduce((s, b) => s + b.durationSec, 0);
}

/** Средний HR по фактическим work-блокам (NULL игнорируются). */
export function avgWorkHr(
  blocks: ReadonlyArray<{ kind: "work" | "rest"; hrAvg: number | null }>,
): number | null {
  const vals: number[] = [];
  for (const b of blocks) {
    if (b.kind === "work" && b.hrAvg != null) vals.push(b.hrAvg);
  }
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}
