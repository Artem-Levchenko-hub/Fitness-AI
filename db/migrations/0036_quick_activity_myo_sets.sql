ALTER TABLE "quick_activities" ADD COLUMN "myo_sets" jsonb;
--> statement-breakpoint
UPDATE "quick_activities"
SET "myo_sets" = (
  SELECT jsonb_agg(item ORDER BY ordinal)
  FROM (
    SELECT
      0 AS ordinal,
      jsonb_build_object(
        'role', 'activation',
        'reps', "myo_activation_reps",
        'weightKg', "weight_kg",
        'restSeconds', "myo_first_rest_seconds"
      ) AS item
    UNION ALL
    SELECT
      series AS ordinal,
      jsonb_build_object(
        'role', 'mini',
        'reps', "myo_mini_reps",
        'weightKg', "weight_kg",
        'restSeconds', "myo_rest_seconds"
      ) AS item
    FROM generate_series(1, COALESCE("myo_mini_sets", 0)) series
  ) structured
)
WHERE "mode" = 'myo_reps'
  AND "myo_activation_reps" IS NOT NULL
  AND "myo_sets" IS NULL;
