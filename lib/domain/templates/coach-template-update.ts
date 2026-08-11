export type CoachTemplateItemUpdate = {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeightKg?: number | null;
  targetRestSeconds: number;
  myoReps?: boolean;
  myoMiniSets?: number;
  myoMiniReps?: number;
  myoMiniRestSeconds?: number;
  notes?: string | null;
};

export type ExistingCoachTemplateItem = {
  exerciseId: string;
  targetWeightKg: number | null;
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
  notes?: string | null;
};

export type MergedCoachTemplateItem = CoachTemplateItemUpdate & {
  targetWeightKg: number | null;
  myoReps: boolean;
  myoMiniSets: number;
  myoMiniReps: number;
  myoMiniRestSeconds: number;
  notes: string | null;
};

/**
 * AI sends a full exercise list, but optional fields mean "unchanged", not
 * "reset to defaults". Match repeated exercises by occurrence so reordering
 * and duplicate exercise IDs do not silently erase an existing Myo protocol.
 */
export function mergeCoachTemplateItems(
  updates: CoachTemplateItemUpdate[],
  current: ExistingCoachTemplateItem[],
): MergedCoachTemplateItem[] {
  const unused = current.map((item) => ({ item, used: false }));

  return updates.map((update) => {
    const match = unused.find(
      (candidate) =>
        !candidate.used && candidate.item.exerciseId === update.exerciseId,
    );
    if (match) match.used = true;
    const previous = match?.item;

    return {
      ...update,
      targetWeightKg:
        update.targetWeightKg === undefined
          ? (previous?.targetWeightKg ?? null)
          : update.targetWeightKg,
      myoReps: update.myoReps ?? previous?.myoReps ?? false,
      myoMiniSets: update.myoMiniSets ?? previous?.myoMiniSets ?? 3,
      myoMiniReps: update.myoMiniReps ?? previous?.myoMiniReps ?? 5,
      myoMiniRestSeconds: Math.min(
        update.myoMiniRestSeconds ?? previous?.myoMiniRestSeconds ?? 20,
        30,
      ),
      notes:
        update.notes === undefined ? (previous?.notes ?? null) : update.notes,
    };
  });
}
