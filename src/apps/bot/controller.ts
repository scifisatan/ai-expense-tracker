import type { CloudflareBindings } from '@/apps/env';
import { createDb } from '@/db/client';
import * as ledgerRepo from '@/db/repositories/ledger';
import * as usersRepo from '@/db/repositories/users';
import * as settingsRepo from '@/db/repositories/settings';
import { createAiService } from '@/services/ai';
import { createLedgerService } from '@/services/ledger';
import { createTelegramBalancePublisher } from '@/services/telegram-balance';
import { computeLedgerTotals } from '@/services/ledger-totals';
import type { NewLedgerTransaction, LedgerTransaction, TransactionItem, TransactionType } from '@/shared/types';
import type { TelegramUserRecord } from '@/db/repositories/types';

export type BotController = {
  registerUser(user: TelegramUserRecord): Promise<void>;
  processMessage(
    chatId: number, 
    userId: number, 
    text: string
  ): Promise<{ items: NewLedgerTransaction[]; net: number; newBalance: number } | null>;
  refreshBalance(chatId: number): Promise<number>;
  listTransactions(chatId: number, limit?: number): Promise<LedgerTransaction[]>;
  getGroqKey(userId: number): Promise<string | null>;
  setGroqKey(userId: number, apiKey: string): Promise<void>;
  removeGroqKey(userId: number): Promise<void>;
};

export function createBotController(env: CloudflareBindings): BotController {
  const db = createDb(env.DB);
  const ai = createAiService({ model: env.AI_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct" });
  const balancePublisher = createTelegramBalancePublisher(env.BOT_TOKEN);
  const ledger = createLedgerService(db, balancePublisher);

  const normalizeExtractedTransaction = (item: TransactionItem): NewLedgerTransaction => ({
    amount: Math.abs(item.amount),
    type: item.type as TransactionType,
    note: item.note
  });

  return {
    async registerUser(user) {
      await usersRepo.saveTelegramUser(db, user);
    },

    async processMessage(chatId, userId, text) {
      const groqKey = await settingsRepo.getGroqApiKey(db, userId);
      if (!groqKey) return null;

      const extracted = await ai.extractTransactions(text, groqKey);
      if (!extracted.items.length) return null;

      const normalizedItems = extracted.items.map(normalizeExtractedTransaction);
      const { net } = computeLedgerTotals(normalizedItems);
      const { newBalance } = await ledger.addTransactions(
        chatId,
        userId,
        normalizedItems,
        text
      );

      return {
        items: normalizedItems,
        net,
        newBalance
      };
    },

    async refreshBalance(chatId) {
      return await ledger.refreshBalance(chatId);
    },

    async listTransactions(chatId, limit = 10) {
      return await ledger.listRecent(chatId, limit);
    },

    async getGroqKey(userId) {
      return await settingsRepo.getGroqApiKey(db, userId);
    },

    async setGroqKey(userId, apiKey) {
      await settingsRepo.setGroqApiKey(db, userId, apiKey);
    },

    async removeGroqKey(userId) {
      await settingsRepo.removeGroqApiKey(db, userId);
    }
  };
}
