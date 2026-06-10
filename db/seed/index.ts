import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../schema";
import { EXERCISES } from "./exercises.seed";
import { MUSCLE_GROUPS } from "./muscle-groups.seed";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for seeding.");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client, { schema, casing: "snake_case" });

async function seedMuscleGroups() {
  console.log(`→ muscle_groups: upserting ${MUSCLE_GROUPS.length} rows`);
  for (const mg of MUSCLE_GROUPS) {
    await db
      .insert(schema.muscleGroups)
      .values(mg)
      .onConflictDoUpdate({
        target: schema.muscleGroups.key,
        set: { nameRu: mg.nameRu, nameEn: mg.nameEn },
      });
  }
}

async function seedExercises() {
  console.log(`→ exercises: upserting ${EXERCISES.length} system exercises`);
  for (const ex of EXERCISES) {
    const [row] = await db
      .insert(schema.exercises)
      .values({
        slug: ex.slug,
        nameRu: ex.nameRu,
        nameEn: ex.nameEn,
        description: ex.description,
        isCustom: false,
        isBodyweight: ex.isBodyweight ?? false,
        ownerUserId: null,
      })
      .onConflictDoUpdate({
        target: [schema.exercises.slug, schema.exercises.ownerUserId],
        set: {
          nameRu: ex.nameRu,
          nameEn: ex.nameEn,
          description: ex.description,
          isBodyweight: ex.isBodyweight ?? false,
        },
      })
      .returning({ id: schema.exercises.id });

    if (!row) continue;

    // Перезаписываем muscle group bindings: чистим старое + вставляем новое.
    await db
      .delete(schema.exerciseMuscleGroups)
      .where(sql`${schema.exerciseMuscleGroups.exerciseId} = ${row.id}`);

    const bindings = [
      ...ex.primary.map((key) => ({
        exerciseId: row.id,
        muscleGroupKey: key,
        role: "primary" as const,
      })),
      ...(ex.secondary ?? []).map((key) => ({
        exerciseId: row.id,
        muscleGroupKey: key,
        role: "secondary" as const,
      })),
    ];

    if (bindings.length > 0) {
      await db.insert(schema.exerciseMuscleGroups).values(bindings);
    }
  }
}

async function main() {
  console.log("Seeding system data into Postgres...");
  await seedMuscleGroups();
  await seedExercises();
  console.log("✓ Seed complete");
}

main()
  .catch((err) => {
    console.error("✗ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
