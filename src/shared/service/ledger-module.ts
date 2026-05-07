import { type LedgerRepo } from "@/shared/service/ledger-repo";
import type {
  BalanceProjection,
  LedgerTransaction,
  LedgerTransactionPatch,
  NewLedgerTransaction,
} from "@/shared/types/ledger";

export interface LedgerModule {
  listRecent(chatId: number, limit?: number): Promise<LedgerTransaction[]>;
  getSummary(chatId: number): Promise<BalanceProjection>;
  addTransactions(
    chatId: number,
    userId: number,
    items: NewLedgerTransaction[],
    fallbackNote?: string,
  ): Promise<{ newBalance: number }>;
  updateTransaction(
    chatId: number,
    id: number,
    patch: LedgerTransactionPatch,
  ): Promise<{ newBalance: number }>;
  deleteTransactions(chatId: number, ids: number[]): Promise<{ newBalance: number }>;
}

export interface LedgerModuleConfig {
  repo: LedgerRepo;
}

export const createLedgerModule = (config: LedgerModuleConfig): LedgerModule => {

  return {
    async listRecent(chatId: number, limit = 10) {
      return config.repo.listRecent(chatId, limit);
    },

    async getSummary(chatId: number) {
      return config.repo.getSummary(chatId);
    },

    async addTransactions(chatId: number, userId: number, items, fallbackNote) {
      if (!items.length) {
        const summary = await config.repo.getSummary(chatId);
        return { newBalance: summary.net };
      }

      await config.repo.addMany(chatId, userId, items, fallbackNote);
      const summary = await config.repo.getSummary(chatId);
      return { newBalance: summary.net };
    },

    async updateTransaction(chatId: number, id: number, patch) {
      const current = await config.repo.getById(chatId, id);
      if (!current) throw new Error("TRANSACTION_NOT_FOUND");

      const nextPatch = {
        amount: patch.amount !== undefined ? Math.abs(patch.amount) : current.amount,
        type: patch.type ?? current.type,
        note: patch.note !== undefined ? patch.note : current.note,
      };

      await config.repo.updateById(chatId, id, nextPatch);
      const summary = await config.repo.getSummary(chatId);
      return { newBalance: summary.net };
    },

    async deleteTransactions(chatId: number, ids: number[]) {
      if (ids.length > 0) {
        await config.repo.deleteMany(chatId, ids);
      }

      const summary = await config.repo.getSummary(chatId);
      return { newBalance: summary.net };
    }
  };
};
