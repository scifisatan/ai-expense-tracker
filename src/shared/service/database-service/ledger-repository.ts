import type { LedgerRepository } from "./types"
import type { LedgerTransaction, TransactionType } from "@/shared/types/ledger"

const toLedgerTransaction = (row: {
  id: number
  chat_id: number
  amount: number
  type: TransactionType
  note: string | null
  created_at: string
}): LedgerTransaction => ({
  id: row.id,
  chatId: row.chat_id,
  amount: row.amount,
  type: row.type,
  note: row.note,
  createdAt: row.created_at
})

export const createLedgerRepository = (db: D1Database): LedgerRepository => ({
  async listRecent(chatId: number, limit = 10) {
    const { results } = await db
      .prepare(
        `
          SELECT id, chat_id, amount, type, note, created_at
          FROM transactions
          WHERE chat_id = ?
          ORDER BY id DESC
          LIMIT ?
        `
      )
      .bind(chatId, limit)
      .all<{
        id: number
        chat_id: number
        amount: number
        type: TransactionType
        note: string | null
        created_at: string
      }>()

    return (results ?? []).map(toLedgerTransaction)
  },

  async getSummary(chatId: number) {
    const row = await db
      .prepare(
        `
          SELECT
            COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END), 0) AS net,
            COUNT(*) AS transactions
          FROM transactions
          WHERE chat_id = ?
        `
      )
      .bind(chatId)
      .first<{ income: number; expense: number; net: number; transactions: number }>()

    return {
      income: Number(row?.income ?? 0),
      expense: Number(row?.expense ?? 0),
      net: Number(row?.net ?? 0),
      transactions: Number(row?.transactions ?? 0)
    }
  },

  async insertTransactions(chatId, userId, items, fallbackNote) {
    if (!items.length) return

    const statements = items.map((item) =>
      db
        .prepare(
          `
            INSERT INTO transactions (chat_id, user_id, amount, type, note)
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .bind(chatId, userId, Math.abs(item.amount), item.type, item.note ?? fallbackNote ?? null)
    )

    await db.batch(statements)
  },

  async findTransaction(chatId: number, id: number) {
    const row = await db
      .prepare(
        "SELECT id, chat_id, amount, type, note, created_at FROM transactions WHERE id = ? AND chat_id = ?"
      )
      .bind(id, chatId)
      .first<{
        id: number
        chat_id: number
        amount: number
        type: TransactionType
        note: string | null
        created_at: string
      }>()

    return row ? toLedgerTransaction(row) : null
  },

  async updateTransaction(chatId, id, patch) {
    await db
      .prepare(
        "UPDATE transactions SET amount = ?, type = ?, note = ? WHERE id = ? AND chat_id = ?"
      )
      .bind(Math.abs(patch.amount), patch.type, patch.note, id, chatId)
      .run()
  },

  async deleteTransactions(chatId, ids) {
    if (!ids.length) return

    const placeholders = ids.map(() => "?").join(",")
    await db
      .prepare(`DELETE FROM transactions WHERE chat_id = ? AND id IN (${placeholders})`)
      .bind(chatId, ...ids)
      .run()
  }
})
