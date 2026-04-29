import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";

type CreditTxType = (typeof schema.creditTxType.enumValues)[number];
type CreditTxRefType = (typeof schema.creditTxRefType.enumValues)[number];

export type Balance = {
  balanceKopecks: number;
  totalPurchasedKopecks: number;
  totalSpentKopecks: number;
};

export async function getOrCreateBalance(userId: string): Promise<Balance> {
  const [existing] = await db
    .select()
    .from(schema.userCredits)
    .where(eq(schema.userCredits.userId, userId))
    .limit(1);
  if (existing) {
    return {
      balanceKopecks: existing.balanceKopecks,
      totalPurchasedKopecks: existing.totalPurchasedKopecks,
      totalSpentKopecks: existing.totalSpentKopecks,
    };
  }

  await db
    .insert(schema.userCredits)
    .values({ userId })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(schema.userCredits)
    .where(eq(schema.userCredits.userId, userId))
    .limit(1);

  return {
    balanceKopecks: row?.balanceKopecks ?? 0,
    totalPurchasedKopecks: row?.totalPurchasedKopecks ?? 0,
    totalSpentKopecks: row?.totalSpentKopecks ?? 0,
  };
}

export type DebitResult =
  | { ok: true; balanceAfter: number; txId: string }
  | { ok: false; reason: "insufficient_funds"; balance: number };

/** Атомарное списание. Если средств недостаточно — возвращает
 *  insufficient_funds без побочных эффектов. */
export async function debit(
  userId: string,
  amountKopecks: number,
  description: string,
  ref?: { id: string; type: CreditTxRefType },
): Promise<DebitResult> {
  if (amountKopecks <= 0) throw new Error("amountKopecks must be > 0");

  return db.transaction(async (tx) => {
    // Гарантируем существование строки баланса
    await tx
      .insert(schema.userCredits)
      .values({ userId })
      .onConflictDoNothing();

    // Атомарно: UPDATE с проверкой остатка через WHERE
    const updated = await tx
      .update(schema.userCredits)
      .set({
        balanceKopecks: sql`${schema.userCredits.balanceKopecks} - ${amountKopecks}`,
        totalSpentKopecks: sql`${schema.userCredits.totalSpentKopecks} + ${amountKopecks}`,
      })
      .where(
        and(
          eq(schema.userCredits.userId, userId),
          sql`${schema.userCredits.balanceKopecks} >= ${amountKopecks}`,
        ),
      )
      .returning({ balanceAfter: schema.userCredits.balanceKopecks });

    if (updated.length === 0) {
      const [bal] = await tx
        .select({ b: schema.userCredits.balanceKopecks })
        .from(schema.userCredits)
        .where(eq(schema.userCredits.userId, userId))
        .limit(1);
      return {
        ok: false as const,
        reason: "insufficient_funds" as const,
        balance: bal?.b ?? 0,
      };
    }

    const balanceAfter = updated[0]!.balanceAfter;

    const [txRow] = await tx
      .insert(schema.creditTransactions)
      .values({
        userId,
        type: "spend" satisfies CreditTxType,
        amountKopecks: -amountKopecks,
        balanceAfterKopecks: balanceAfter,
        description,
        referenceId: ref?.id ?? null,
        referenceType: ref?.type ?? null,
      })
      .returning({ id: schema.creditTransactions.id });

    return { ok: true as const, balanceAfter, txId: txRow!.id };
  });
}

/** Зачисление credits — для покупки через ЮKassa или admin adjustment.
 *  Идемпотентно по (referenceType, referenceId): если уже была покупка
 *  с этим референсом, повторно не зачисляет. */
export async function credit(
  userId: string,
  amountKopecks: number,
  description: string,
  ref: { id: string; type: CreditTxRefType },
  txType: CreditTxType = "purchase",
): Promise<{ balanceAfter: number; alreadyApplied: boolean }> {
  if (amountKopecks <= 0) throw new Error("amountKopecks must be > 0");

  return db.transaction(async (tx) => {
    // Идемпотентность: ищем существующую транзакцию с тем же ref
    const existing = await tx
      .select({ id: schema.creditTransactions.id })
      .from(schema.creditTransactions)
      .where(
        and(
          eq(schema.creditTransactions.referenceId, ref.id),
          eq(schema.creditTransactions.referenceType, ref.type),
          eq(schema.creditTransactions.type, txType),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      const [bal] = await tx
        .select({ b: schema.userCredits.balanceKopecks })
        .from(schema.userCredits)
        .where(eq(schema.userCredits.userId, userId))
        .limit(1);
      return { balanceAfter: bal?.b ?? 0, alreadyApplied: true };
    }

    await tx
      .insert(schema.userCredits)
      .values({ userId })
      .onConflictDoNothing();

    const updated = await tx
      .update(schema.userCredits)
      .set({
        balanceKopecks: sql`${schema.userCredits.balanceKopecks} + ${amountKopecks}`,
        totalPurchasedKopecks:
          txType === "purchase"
            ? sql`${schema.userCredits.totalPurchasedKopecks} + ${amountKopecks}`
            : schema.userCredits.totalPurchasedKopecks,
      })
      .where(eq(schema.userCredits.userId, userId))
      .returning({ balanceAfter: schema.userCredits.balanceKopecks });

    const balanceAfter = updated[0]!.balanceAfter;

    await tx.insert(schema.creditTransactions).values({
      userId,
      type: txType,
      amountKopecks,
      balanceAfterKopecks: balanceAfter,
      description,
      referenceId: ref.id,
      referenceType: ref.type,
    });

    return { balanceAfter, alreadyApplied: false };
  });
}

export async function listTransactions(userId: string, limit = 30) {
  return db
    .select()
    .from(schema.creditTransactions)
    .where(eq(schema.creditTransactions.userId, userId))
    .orderBy(desc(schema.creditTransactions.createdAt))
    .limit(limit);
}
