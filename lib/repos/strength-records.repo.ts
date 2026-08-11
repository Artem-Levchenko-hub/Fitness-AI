import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  STRENGTH_MOVEMENTS,
  type StrengthMovement,
} from "@/db/schema/strength-records";

export async function listStrengthRecords(
  userId: string,
): Promise<schema.StrengthRecord[]> {
  // По каждому движению берём недавнюю историю и абсолютный максимум отдельно:
  // старый PR не теряется, а объём ответа остаётся ограниченным.
  const groups = await Promise.all(
    STRENGTH_MOVEMENTS.map(async (movement) => {
      const where = and(
        eq(schema.strengthRecords.userId, userId),
        eq(schema.strengthRecords.movement, movement),
      );
      const [recent, best] = await Promise.all([
        db
          .select()
          .from(schema.strengthRecords)
          .where(where)
          .orderBy(
            desc(schema.strengthRecords.performedAt),
            desc(schema.strengthRecords.createdAt),
          )
          .limit(10),
        db
          .select()
          .from(schema.strengthRecords)
          .where(where)
          .orderBy(
            desc(schema.strengthRecords.value),
            desc(schema.strengthRecords.performedAt),
          )
          .limit(1),
      ]);
      return [...recent, ...best];
    }),
  );

  return [...new Map(groups.flat().map((record) => [record.id, record])).values()];
}

export async function addStrengthRecord(
  userId: string,
  input: {
    movement: StrengthMovement;
    value: number;
    performedAt: string;
  },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.strengthRecords)
    .values({ userId, ...input })
    .returning({ id: schema.strengthRecords.id });

  return { id: row!.id };
}

export async function deleteStrengthRecord(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(schema.strengthRecords)
    .where(
      and(
        eq(schema.strengthRecords.id, id),
        eq(schema.strengthRecords.userId, userId),
      ),
    );
}
