INSERT INTO "template_versions" (
  "id",
  "template_id",
  "version_number",
  "source",
  "source_workout_id",
  "snapshot",
  "summary",
  "confirmed_at",
  "created_at"
)
SELECT
  gen_random_uuid()::text,
  wt."id",
  1,
  'manual',
  NULL,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'exerciseId', te."exercise_id",
        'position', te."position",
        'targetSets', te."target_sets",
        'targetRepsMin', te."target_reps_min",
        'targetRepsMax', te."target_reps_max",
        'targetWeightKg', te."target_weight_kg",
        'targetRestSeconds', te."target_rest_seconds",
        'setScheme', te."set_scheme",
        'myoMiniSets', te."myo_mini_sets",
        'myoRepsPercent', te."myo_reps_percent",
        'myoRestSeconds', te."myo_rest_seconds",
        'notes', te."notes"
      )
      ORDER BY te."position"
    ) FILTER (WHERE te."id" IS NOT NULL),
    '[]'::jsonb
  ),
  'Исходная версия',
  wt."created_at",
  wt."created_at"
FROM "workout_templates" wt
LEFT JOIN "template_exercises" te ON te."template_id" = wt."id"
WHERE NOT EXISTS (
  SELECT 1
  FROM "template_versions" tv
  WHERE tv."template_id" = wt."id"
)
GROUP BY wt."id", wt."created_at";
