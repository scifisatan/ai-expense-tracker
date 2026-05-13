import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type { AppDb } from '../client';
import { transactions } from '../schema';
import type { LedgerTransactionUpdate } from '../repositories/types';
import type { NewLedgerTransaction } from '@/shared/types';

export async function listRecent(db: AppDb, chatId: number, limit = 10) {
  return await db.query.transactions.findMany({
    where: eq(transactions.chatId, chatId),
    orderBy: [desc(transactions.id)],
    limit,
  });
}

export async function getSummary(db: AppDb, chatId: number) {
  const result = await db
    .select({
      income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
      transactions: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(eq(transactions.chatId, chatId))
    .get();

  return {
    income: result?.income ?? 0,
    expense: result?.expense ?? 0,
    net: result?.net ?? 0,
    transactions: result?.transactions ?? 0,
  };
}

export async function insertTransactions(
  db: AppDb,
  chatId: number,
  userId: number,
  items: NewLedgerTransaction[],
  fallbackNote?: string
) {
  if (!items.length) return;

  await db.insert(transactions).values(
    items.map((item) => ({
      chatId,
      userId,
      amount: Math.abs(item.amount),
      type: item.type,
      note: item.note ?? fallbackNote ?? null,
    }))
  );
}

export async function findTransaction(db: AppDb, chatId: number, id: number) {
  return await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.chatId, chatId)),
  });
}

export async function updateTransaction(
  db: AppDb,
  chatId: number,
  id: number,
  patch: LedgerTransactionUpdate
) {
  await db
    .update(transactions)
    .set({
      amount: Math.abs(patch.amount),
      type: patch.type,
      note: patch.note,
    })
    .where(and(eq(transactions.id, id), eq(transactions.chatId, chatId)));
}

export async function deleteTransactions(db: AppDb, chatId: number, ids: number[]) {
  if (!ids.length) return;

  await db
    .delete(transactions)
    .where(and(eq(transactions.chatId, chatId), inArray(transactions.id, ids)));
}
