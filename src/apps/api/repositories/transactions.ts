import type { AppDb } from "@/db/client"

import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { transactions } from "@/db/schema"
import type { NewLedgerTransaction } from "@/shared/types"

export type TransactionPatch = {
  amountMinor?: number
  currency?: string
  type?: "Income" | "Expense"
  categoryId?: number | null
  note?: string | null
  occurredAt?: string
}

export type InsertLedgerPayload = {
  accountId: string
  items: NewLedgerTransaction[]
  source: "web" | "telegram"
  fallbackNote?: string
}

export const createTransactionsRepo = (db: AppDb) => ({
  listRecent: (accountId: string, limit: number) =>
    db.query.transactions.findMany({
      where: eq(transactions.accountId, accountId),
      orderBy: [desc(transactions.id)],
      limit,
    }),

  findById: (accountId: string, id: number) =>
    db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.accountId, accountId)),
    }),

  insertOne: (
    accountId: string,
    input: {
      amountMinor: number
      currency: string
      type: "Income" | "Expense"
      categoryId?: number | null
      note?: string | null
      occurredAt?: string
      source: "web" | "telegram"
    },
  ) =>
    db
      .insert(transactions)
      .values({
        accountId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        type: input.type,
        categoryId: input.categoryId ?? null,
        note: input.note ?? null,
        occurredAt: input.occurredAt,
        source: input.source,
      })
      .returning(),

  updateById: (accountId: string, id: number, patch: TransactionPatch) =>
    db
      .update(transactions)
      .set(patch)
      .where(and(eq(transactions.id, id), eq(transactions.accountId, accountId))),

  deleteByIds: (accountId: string, ids: number[]) =>
    db
      .delete(transactions)
      .where(and(eq(transactions.accountId, accountId), inArray(transactions.id, ids))),

  insertLedger: (payload: InsertLedgerPayload) => {
    const { accountId, items, source, fallbackNote } = payload

    if (items.length === 0) {
      return Promise.resolve()
    }

    return db.insert(transactions).values(
      items.map((item) => ({
        accountId,
        amountMinor: Math.abs(item.amountMinor),
        currency: item.currency ?? "USD",
        type: item.type,
        categoryId: item.categoryId ?? null,
        note: item.note ?? fallbackNote ?? null,
        source,
      })),
    )
  },

  getNetBalance: async (accountId: string): Promise<number> => {
    const result = await db
      .select({
        net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE -${transactions.amountMinor} END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .get()

    return result?.net ?? 0
  },

  getSummary: async (accountId: string) => {
    const result = await db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Expense' THEN ${transactions.amountMinor} ELSE 0 END), 0)`,
        net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE -${transactions.amountMinor} END), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .get()

    return {
      income: result?.income ?? 0,
      expense: result?.expense ?? 0,
      net: result?.net ?? 0,
      transactions: result?.count ?? 0,
    }
  },
})

export type TransactionsRepo = ReturnType<typeof createTransactionsRepo>
