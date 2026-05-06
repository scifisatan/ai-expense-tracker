import { createAIService } from './ai';
import { createTransactionStore } from '../storage/transaction-store';
import { computeTotals } from '../bot/transactions';
import { log } from '../config/logger';
import { LedgerDisplay } from './ledger-display/interface';

export interface TransactionManagerConfig {
  db: D1Database;
  aiModel: string;
  display: LedgerDisplay;
}

export const createTransactionManager = (config: TransactionManagerConfig) => {
  const store = createTransactionStore(config.db);
  const ai = createAIService({ model: config.aiModel });

  /**
   * Internal helper to ensure 'Income' is always stored as 'Income'
   */
  const normalizeType = (type: string) => (type === 'Income' ? 'Income' : type);

  /**
   * Recalculates the entire balance from history and updates the display.
   * Useful for syncing after edits or /start.
   */
  const refreshPinnedBalance = async (chatId: number) => {
    // We fetch a large enough history to get an accurate balance
    const transactions = await store.listRecent(chatId, 1000);
    const totalIncome = transactions
      .filter((tx) => tx.type === 'Income' || tx.type === 'Income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = transactions
      .filter((tx) => tx.type === 'Expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const currentBalance = totalIncome - totalExpense;
    await config.display.updateBalance(chatId, currentBalance);
    return currentBalance;
  };

  return {
    refreshPinnedBalance,

    /**
     * The primary entry point for the Bot.
     * Extracts transactions from text, saves them, and updates balance.
     */
    async processUserMessage(chatId: number, userId: number, text: string, groqKey: string) {
      const extracted = await ai.extractTransactions(text, groqKey);
      if (!extracted.items.length) return null;

      const normalizedItems = extracted.items.map((item) => ({
        ...item,
        type: normalizeType(item.type),
      }));

      const { net } = computeTotals(normalizedItems);
      
      // We calculate current balance from history to be safe
      const transactions = await store.listRecent(chatId, 1000);
      const historyBalance = transactions
        .filter((tx) => tx.type === 'Income' || tx.type === 'Income')
        .reduce((sum, tx) => sum + tx.amount, 0) -
        transactions
        .filter((tx) => tx.type === 'Expense')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const newBalance = historyBalance + net;
      
      await store.addMany(chatId, userId, normalizedItems, text);
      await config.display.updateBalance(chatId, newBalance);

      return {
        items: normalizedItems,
        net,
        newBalance,
      };
    },

    /**
     * The primary entry point for the Web Dashboard.
     * Updates an existing transaction and refreshes the balance display.
     */
    async updateTransaction(chatId: number, transactionId: number, patch: { amount?: number; type?: string; note?: string | null }) {
      const current = await config.db
        .prepare('SELECT id, amount, type, note FROM transactions WHERE id = ? AND chat_id = ?')
        .bind(transactionId, chatId)
        .first<{ id: number; amount: number; type: string; note: string | null }>();

      if (!current) throw new Error('TRANSACTION_NOT_FOUND');

      const nextAmount = patch.amount !== undefined ? Math.abs(patch.amount) : current.amount;
      const nextType = patch.type ? normalizeType(patch.type) : current.type;
      const nextNote = patch.note !== undefined ? patch.note : current.note;

      await config.db
        .prepare('UPDATE transactions SET amount = ?, type = ?, note = ? WHERE id = ? AND chat_id = ?')
        .bind(nextAmount, nextType, nextNote, transactionId, chatId)
        .run();

      const newBalance = await refreshPinnedBalance(chatId);
      return { newBalance };
    },

    async deleteTransactions(chatId: number, ids: number[]) {
      if (ids.length === 0) return { newBalance: await refreshPinnedBalance(chatId) };

      const placeholders = ids.map(() => '?').join(',');
      await config.db
        .prepare(`DELETE FROM transactions WHERE chat_id = ? AND id IN (${placeholders})`)
        .bind(chatId, ...ids)
        .run();

      const newBalance = await refreshPinnedBalance(chatId);
      return { newBalance };
    }
  };
};

export type TransactionManager = ReturnType<typeof createTransactionManager>;
