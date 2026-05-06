import type { TransactionItem } from '../bot/types';

export type StoredTransaction = {
  id: number;
  chatId: number;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
};

export const createTransactionStore = (db: D1Database) => {
  return {
    async addMany(chatId: number, userId: number, items: TransactionItem[], note?: string) {
      if (!items.length) return;

      const statements = items.map((item) =>
        db
          .prepare(
            `
              INSERT INTO transactions (chat_id, user_id, amount, type, note)
              VALUES (?, ?, ?, ?, ?)
            `
          )
          .bind(chatId, userId, Math.abs(item.amount), item.type, item.note || note || null)
      );

      await db.batch(statements);
    },

    async listRecent(chatId: number, limit = 10): Promise<StoredTransaction[]> {
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
          id: number;
          chat_id: number;
          amount: number;
          type: string;
          note: string | null;
          created_at: string;
        }>();

      return (results ?? []).map((row) => ({
        id: row.id,
        chatId: row.chat_id,
        amount: row.amount,
        type: row.type,
        note: row.note,
        createdAt: row.created_at,
      }));
    },
  };
};

export type TransactionStore = ReturnType<typeof createTransactionStore>;
