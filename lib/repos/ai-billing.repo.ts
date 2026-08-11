import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { postgresTimestampParameter } from "@/lib/billing/postgres-timestamp";

type Coverage = (typeof schema.AI_BILLING_COVERAGE)[number];

export type ClaimAiBillingOperation =
  | {
      kind: "claimed";
      attempt: number;
      billingReferenceId: string;
      coverage: Coverage;
      priceKopecks: number;
    }
  | { kind: "insufficient_funds"; balance: number; priceKopecks: number }
  | { kind: "in_progress" }
  | { kind: "cached"; responseText: string };

export async function claimCoachBillingOperation(input: {
  id: string;
  userId: string;
  workoutId: string;
  coverage: Coverage;
  priceKopecks: number;
  now?: Date;
}): Promise<ClaimAiBillingOperation> {
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    const chargeWallet = async (attempt: number) => {
      if (input.coverage !== "wallet" || input.priceKopecks <= 0) {
        return { ok: true as const };
      }
      await tx
        .insert(schema.userCredits)
        .values({ userId: input.userId })
        .onConflictDoNothing();
      const [updated] = await tx
        .update(schema.userCredits)
        .set({
          balanceKopecks: sql`${schema.userCredits.balanceKopecks} - ${input.priceKopecks}`,
          totalSpentKopecks: sql`${schema.userCredits.totalSpentKopecks} + ${input.priceKopecks}`,
        })
        .where(
          and(
            eq(schema.userCredits.userId, input.userId),
            sql`${schema.userCredits.balanceKopecks} >= ${input.priceKopecks}`,
          ),
        )
        .returning({ balance: schema.userCredits.balanceKopecks });
      if (!updated) {
        const [wallet] = await tx
          .select({ balance: schema.userCredits.balanceKopecks })
          .from(schema.userCredits)
          .where(eq(schema.userCredits.userId, input.userId))
          .limit(1);
        return { ok: false as const, balance: wallet?.balance ?? 0 };
      }

      await tx.insert(schema.creditTransactions).values({
        userId: input.userId,
        type: "spend",
        amountKopecks: -input.priceKopecks,
        balanceAfterKopecks: updated.balance,
        description: "AI-тренер: ответ в диалоге",
        referenceId: `${input.id}:${attempt}`,
        referenceType: "ai_coach_session",
      });
      await tx
        .update(schema.aiBillingOperations)
        .set({ chargedAt: now })
        .where(eq(schema.aiBillingOperations.id, input.id));
      return { ok: true as const };
    };

    const [inserted] = await tx
      .insert(schema.aiBillingOperations)
      .values({
        id: input.id,
        userId: input.userId,
        workoutId: input.workoutId,
        coverage: input.coverage,
        priceKopecks: input.priceKopecks,
        attempt: 1,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      const charged = await chargeWallet(1);
      if (!charged.ok) {
        await tx
          .update(schema.aiBillingOperations)
          .set({
            status: "failed",
            lastError: "insufficient_funds",
            updatedAt: now,
          })
          .where(eq(schema.aiBillingOperations.id, input.id));
        return {
          kind: "insufficient_funds" as const,
          balance: charged.balance,
          priceKopecks: input.priceKopecks,
        };
      }
      return {
        kind: "claimed" as const,
        attempt: 1,
        billingReferenceId: `${input.id}:1`,
        coverage: input.coverage,
        priceKopecks: input.priceKopecks,
      };
    }

    const [existing] = await tx
      .select()
      .from(schema.aiBillingOperations)
      .where(eq(schema.aiBillingOperations.id, input.id))
      .for("update")
      .limit(1);
    if (
      !existing ||
      existing.userId !== input.userId ||
      existing.workoutId !== input.workoutId
    ) {
      throw new Error("AI billing operation ownership mismatch");
    }
    if (existing.status === "succeeded" && existing.responseText !== null) {
      return { kind: "cached" as const, responseText: existing.responseText };
    }
    if (existing.status === "processing") {
      return { kind: "in_progress" as const };
    }

    const attempt = existing.attempt + 1;
    await tx
      .update(schema.aiBillingOperations)
      .set({
        status: "processing",
        coverage: input.coverage,
        priceKopecks: input.priceKopecks,
        attempt,
        responseText: null,
        lastError: null,
        chargedAt: null,
        updatedAt: now,
      })
      .where(eq(schema.aiBillingOperations.id, existing.id));

    const charged = await chargeWallet(attempt);
    if (!charged.ok) {
      await tx
        .update(schema.aiBillingOperations)
        .set({
          status: "failed",
          lastError: "insufficient_funds",
          updatedAt: now,
        })
        .where(eq(schema.aiBillingOperations.id, existing.id));
      return {
        kind: "insufficient_funds" as const,
        balance: charged.balance,
        priceKopecks: input.priceKopecks,
      };
    }

    return {
      kind: "claimed" as const,
      attempt,
      billingReferenceId: `${input.id}:${attempt}`,
      coverage: input.coverage,
      priceKopecks: input.priceKopecks,
    };
  });
}

export async function listStaleAiBillingOperations(
  before: Date,
  limit = 50,
) {
  const beforeIso = postgresTimestampParameter(before);
  return db
    .select({ id: schema.aiBillingOperations.id })
    .from(schema.aiBillingOperations)
    .where(
      and(
        eq(schema.aiBillingOperations.status, "processing"),
        sql`${schema.aiBillingOperations.updatedAt} <= ${beforeIso}::timestamptz`,
      ),
    )
    .limit(limit);
}

export async function completeAiBillingOperation(
  id: string,
  responseText: string,
): Promise<boolean> {
  const rows = await db
    .update(schema.aiBillingOperations)
    .set({
      status: "succeeded",
      responseText,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.aiBillingOperations.id, id),
        eq(schema.aiBillingOperations.status, "processing"),
      ),
    )
    .returning({ id: schema.aiBillingOperations.id });
  return rows.length > 0;
}

/** Только победитель terminal-перехода получает право вернуть wallet debit. */
export async function failAiBillingOperation(
  id: string,
  errorCode: string,
): Promise<boolean> {
  const rows = await db
    .update(schema.aiBillingOperations)
    .set({
      status: "failed",
      lastError: errorCode.slice(0, 200),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.aiBillingOperations.id, id),
        eq(schema.aiBillingOperations.status, "processing"),
      ),
    )
    .returning({ id: schema.aiBillingOperations.id });
  return rows.length > 0;
}

/** Атомарно выигрывает terminal race у onFinish и возвращает wallet debit.
 *  Если onFinish уже сохранил успех, баланс не меняется. */
export async function failAndRefundAiBillingOperation(
  id: string,
  errorCode: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [operation] = await tx
      .select()
      .from(schema.aiBillingOperations)
      .where(eq(schema.aiBillingOperations.id, id))
      .for("update")
      .limit(1);
    if (!operation || operation.status !== "processing") return false;

    if (
      operation.coverage === "wallet" &&
      operation.priceKopecks > 0 &&
      operation.chargedAt
    ) {
      await tx
        .insert(schema.userCredits)
        .values({ userId: operation.userId })
        .onConflictDoNothing();
      await tx
        .select()
        .from(schema.userCredits)
        .where(eq(schema.userCredits.userId, operation.userId))
        .for("update")
        .limit(1);
      const [wallet] = await tx
        .update(schema.userCredits)
        .set({
          balanceKopecks: sql`${schema.userCredits.balanceKopecks} + ${operation.priceKopecks}`,
        })
        .where(eq(schema.userCredits.userId, operation.userId))
        .returning({ balance: schema.userCredits.balanceKopecks });
      if (!wallet) throw new Error("AI refund wallet update failed");

      await tx.insert(schema.creditTransactions).values({
        userId: operation.userId,
        type: "refund",
        amountKopecks: operation.priceKopecks,
        balanceAfterKopecks: wallet.balance,
        description: "Возврат: AI-тренер не смог ответить",
        referenceId: `${operation.id}:${operation.attempt}`,
        referenceType: "ai_coach_session",
      });
    }

    await tx
      .update(schema.aiBillingOperations)
      .set({
        status: "failed",
        chargedAt: null,
        lastError: errorCode.slice(0, 200),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiBillingOperations.id, operation.id));
    return true;
  });
}
