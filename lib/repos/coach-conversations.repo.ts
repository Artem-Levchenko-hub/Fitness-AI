import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

export type CoachChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export class CoachMessageConflictError extends Error {
  constructor() {
    super("coach_message_id_conflict");
    this.name = "CoachMessageConflictError";
  }
}

export async function listCoachMessages(
  userId: string,
  workoutId: string,
  limit = 200,
): Promise<CoachChatMessage[]> {
  const rows = await db
    .select({
      id: schema.aiCoachMessages.id,
      role: schema.aiCoachMessages.role,
      content: schema.aiCoachMessages.content,
      createdAt: schema.aiCoachMessages.createdAt,
    })
    .from(schema.aiCoachMessages)
    .where(
      and(
        eq(schema.aiCoachMessages.userId, userId),
        eq(schema.aiCoachMessages.workoutId, workoutId),
      ),
    )
    .orderBy(
      desc(schema.aiCoachMessages.createdAt),
      desc(schema.aiCoachMessages.id),
    )
    .limit(limit);

  return rows.reverse().map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));
}

/** Idempotent insert. Reusing an ID for different content is rejected. */
export async function appendCoachMessage(
  userId: string,
  workoutId: string,
  message: CoachChatMessage,
): Promise<void> {
  const inserted = await db
    .insert(schema.aiCoachMessages)
    .values({ ...message, userId, workoutId })
    .onConflictDoNothing({ target: schema.aiCoachMessages.id })
    .returning({ id: schema.aiCoachMessages.id });
  if (inserted.length > 0) return;

  const [existing] = await db
    .select({
      userId: schema.aiCoachMessages.userId,
      workoutId: schema.aiCoachMessages.workoutId,
      role: schema.aiCoachMessages.role,
      content: schema.aiCoachMessages.content,
    })
    .from(schema.aiCoachMessages)
    .where(eq(schema.aiCoachMessages.id, message.id))
    .limit(1);

  if (
    !existing ||
    existing.userId !== userId ||
    existing.workoutId !== workoutId ||
    existing.role !== message.role ||
    existing.content !== message.content
  ) {
    throw new CoachMessageConflictError();
  }
}
