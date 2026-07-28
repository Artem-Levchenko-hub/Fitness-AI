CREATE TEMP TABLE exercise_dedupe_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY
        slug,
        lower(regexp_replace(trim(name_ru), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(name_en), '\s+', ' ', 'g')),
        is_bodyweight
      ORDER BY created_at, id
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY
        slug,
        lower(regexp_replace(trim(name_ru), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(name_en), '\s+', ' ', 'g')),
        is_bodyweight
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM exercises
  WHERE owner_user_id IS NULL
)
SELECT id AS duplicate_id, canonical_id
FROM ranked
WHERE duplicate_rank > 1;
--> statement-breakpoint
UPDATE template_exercises target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE workout_exercises target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE circuit_template_exercises target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE circuit_exercises target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE exercise_notes target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE quick_activities target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
UPDATE goals target
SET exercise_id = map.canonical_id
FROM exercise_dedupe_map map
WHERE target.exercise_id = map.duplicate_id;
--> statement-breakpoint
INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_key, role)
SELECT map.canonical_id, binding.muscle_group_key, binding.role
FROM exercise_muscle_groups binding
JOIN exercise_dedupe_map map ON map.duplicate_id = binding.exercise_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH rewritten AS (
  SELECT
    version.id,
    jsonb_agg(
    CASE
      WHEN map.canonical_id IS NULL THEN item.value
      ELSE jsonb_set(
        item.value,
        '{exerciseId}',
        to_jsonb(map.canonical_id),
        false
      )
    END
    ORDER BY item.ordinality
  ) AS snapshot
  FROM template_versions version
  CROSS JOIN LATERAL jsonb_array_elements(version.snapshot)
    WITH ORDINALITY AS item(value, ordinality)
  LEFT JOIN exercise_dedupe_map map
    ON map.duplicate_id = item.value ->> 'exerciseId'
  GROUP BY version.id
  HAVING bool_or(map.canonical_id IS NOT NULL)
)
UPDATE template_versions version
SET snapshot = rewritten.snapshot
FROM rewritten
WHERE rewritten.id = version.id;
--> statement-breakpoint
DELETE FROM exercises duplicate
USING exercise_dedupe_map map
WHERE duplicate.id = map.duplicate_id;
