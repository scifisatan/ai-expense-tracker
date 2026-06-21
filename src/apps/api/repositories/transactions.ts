import type { AppDb } from "@/db/client"

import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm"
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
  listRecent: async (accountId: string, limit: number, cursor?: number) => {
    const rows = await db.query.transactions.findMany({
      where: and(
        eq(transactions.accountId, accountId),
        cursor ? lt(transactions.id, cursor) : undefined
      ),
      orderBy: [desc(transactions.id)],
      limit: limit + 1
    })
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null }
  },

  findById: (accountId: string, id: number) =>
    db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.accountId, accountId))
    }),

  // List transactions whose occurredAt is in [from, to). Cursor is the last id
  // seen (descending), enabling keyset pagination over large histories. Fetches
  // limit+1 to report whether another page exists.
  listInRange: async (
    accountId: string,
    from: string,
    to: string,
    limit: number,
    cursor?: number
  ) => {
    const rows = await db.query.transactions.findMany({
      where: and(
        eq(transactions.accountId, accountId),
        gte(transactions.occurredAt, from),
        lt(transactions.occurredAt, to),
        cursor ? lt(transactions.id, cursor) : undefined
      ),
      orderBy: [desc(transactions.id)],
      limit: limit + 1
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null }
  },

  countByAccount: async (accountId: string): Promise<number> => {
    const row = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .get()
    return row?.count ?? 0
  },

  getSummaryInRange: async (accountId: string, from: string, to: string) => {
    const result = await db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Expense' THEN ${transactions.amountMinor} ELSE 0 END), 0)`,
        net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE -${transactions.amountMinor} END), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.occurredAt, from),
          lt(transactions.occurredAt, to)
        )
      )
      .get()

    return {
      income: result?.income ?? 0,
      expense: result?.expense ?? 0,
      net: result?.net ?? 0,
      transactions: result?.count ?? 0
    }
  },

  // Total expense in [from, to) for a single category (null = all categories).
  // Used for budget threshold checks.
  getCategoryExpenseInRange: async (
    accountId: string,
    categoryId: number | null,
    from: string,
    to: string
  ): Promise<number> => {
    const result = await db
      .select({
        expense: sql<number>`COALESCE(SUM(${transactions.amountMinor}), 0)`
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.type, "Expense"),
          gte(transactions.occurredAt, from),
          lt(transactions.occurredAt, to),
          categoryId === null ? undefined : eq(transactions.categoryId, categoryId)
        )
      )
      .get()

    return result?.expense ?? 0
  },

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
    }
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
        source: input.source
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
      return Promise.resolve([] as { id: number }[])
    }

    return db
      .insert(transactions)
      .values(
        items.map((item) => ({
          accountId,
          amountMinor: Math.abs(item.amountMinor),
          currency: item.currency ?? "USD",
          type: item.type,
          categoryId: item.categoryId ?? null,
          note: item.note ?? fallbackNote ?? null,
          // Omit when undefined so the column's CURRENT_TIMESTAMP default applies.
          ...(item.occurredAt ? { occurredAt: item.occurredAt } : {}),
          source
        }))
      )
      .returning({ id: transactions.id })
  },

  getNetBalance: async (accountId: string): Promise<number> => {
    const result = await db
      .select({
        net: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'Income' THEN ${transactions.amountMinor} ELSE -${transactions.amountMinor} END), 0)`
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
        count: sql<number>`COUNT(*)`
      })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .get()

    return {
      income: result?.income ?? 0,
      expense: result?.expense ?? 0,
      net: result?.net ?? 0,
      transactions: result?.count ?? 0
    }
  }
})

export type TransactionsRepo = ReturnType<typeof createTransactionsRepo>
