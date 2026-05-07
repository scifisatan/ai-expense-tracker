import { createAIService } from "./ai";
import { computeTotals } from "../bot/transactions";
import type { LedgerModule } from "../domain/ledger";
import { NewLedgerTransaction } from "@/domain/ledger/types";

export interface TransactionManagerConfig {
  aiModel: string;
  ledger: LedgerModule;
}

export const createTransactionManager = (config: TransactionManagerConfig) => {
  const ai = createAIService({ model: config.aiModel });
  const ledger = config.ledger;

  /**
   * Internal helper to ensure only supported transaction types are persisted.
   */
  const normalizeType = (type: string) => (type === "Income" ? "Income" : "Expense");

  return {
    async refreshPinnedBalance(chatId: number) {
      return ledger.refreshBalance(chatId);
    },

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
      const { newBalance } = await ledger.addTransactions(chatId, userId, normalizedItems as NewLedgerTransaction[], text);

      return {
        items: normalizedItems,
        net,
        newBalance,
      };
    },

    async updateTransaction(
      chatId: number,
      transactionId: number,
      patch: { amount?: number; type?: string; note?: string | null },
    ) {
      return ledger.updateTransaction(chatId, transactionId, {
        amount: patch.amount,
        type: patch.type === "Income" ? "Income" : patch.type === "Expense" ? "Expense" : undefined,
        note: patch.note,
      });
    },

    async deleteTransactions(chatId: number, ids: number[]) {
      return ledger.deleteTransactions(chatId, ids);
    },
  };
};

export type TransactionManager = ReturnType<typeof createTransactionManager>;
