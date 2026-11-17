import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db/client";
import { cycleNotes, exerciseNotes, exercises, workoutNotes, workouts } from "@/db/schema";

const noteLimit = 30;

export async function listAccountNotes(userId: string) {
  const [exerciseRows, workoutRows, cycleRows] = await Promise.all([
    db.select({
      id: exerciseNotes.id, title: exercises.nameRu, content: exerciseNotes.content,
      source: exerciseNotes.source, updatedAt: exerciseNotes.updatedAt,
    }).from(exerciseNotes).innerJoin(exercises, eq(exerciseNotes.exerciseId, exercises.id))
      .where(and(
        eq(exerciseNotes.userId, userId),
        or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, userId)),
      ))
      .orderBy(desc(exerciseNotes.updatedAt)).limit(noteLimit),
    db.select({
      id: workoutNotes.id, title: workouts.name, content: workoutNotes.content,
      source: workoutNotes.source, updatedAt: workoutNotes.updatedAt,
    }).from(workoutNotes).innerJoin(workouts, eq(workoutNotes.workoutId, workouts.id))
      .where(and(eq(workoutNotes.userId, userId), eq(workouts.userId, userId)))
      .orderBy(desc(workoutNotes.updatedAt)).limit(noteLimit),
    db.select({
      id: cycleNotes.id, title: cycleNotes.weekIso, content: cycleNotes.content,
      source: cycleNotes.source, updatedAt: cycleNotes.updatedAt,
    }).from(cycleNotes).where(eq(cycleNotes.userId, userId))
      .orderBy(desc(cycleNotes.updatedAt)).limit(noteLimit),
  ]);
  return [
    ...exerciseRows.map((note) => ({ ...note, kind: "exercise" })),
    ...workoutRows.map((note) => ({ ...note, kind: "workout" })),
    ...cycleRows.map((note) => ({ ...note, kind: "cycle" })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, noteLimit);
}
