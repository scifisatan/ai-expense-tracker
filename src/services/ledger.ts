import type { AppDb } from '@/db/client';
import * as ledgerRepo from '@/db/repositories/ledger';
import type {
  BalanceProjection,
  LedgerTransaction,
  LedgerTransactionPatch,
  NewLedgerTransaction
} from "@/shared/types"

export type LedgerBalancePublisher = {
  publishBalance(chatId: number, balance: number): Promise<void>
}

export type LedgerService = {
  listRecent(chatId: number, limit?: number): Promise<LedgerTransaction[]>
  getSummary(chatId: number): Promise<BalanceProjection>
  addTransactions(
    chatId: number,
    userId: number,
    items: NewLedgerTransaction[],
    fallbackNote?: string
  ): Promise<{ newBalance: number }>
  updateTransaction(
    chatId: number,
    id: number,
    patch: LedgerTransactionPatch
  ): Promise<{ newBalance: number }>
  deleteTransactions(chatId: number, ids: number[]): Promise<{ newBalance: number }>
  refreshBalance(chatId: number): Promise<number>
}

export const createLedgerService = (db: AppDb, balancePublisher?: LedgerBalancePublisher): LedgerService => {
  const publishBalance = async (chatId: number, balance: number) => {
    await balancePublisher?.publishBalance(chatId, balance)
  }

  return {
    async listRecent(chatId: number, limit = 10) {
      return ledgerRepo.listRecent(db, chatId, limit)
    },

    async getSummary(chatId: number) {
      return ledgerRepo.getSummary(db, chatId)
    },

    async addTransactions(chatId, userId, items, fallbackNote) {
      if (items.length) {
        await ledgerRepo.insertTransactions(db, chatId, userId, items, fallbackNote)
      }

      const summary = await ledgerRepo.getSummary(db, chatId)
      if (items.length) await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async updateTransaction(chatId, id, patch) {
      const current = await ledgerRepo.findTransaction(db, chatId, id)
      if (!current) throw new Error("TRANSACTION_NOT_FOUND")

      await ledgerRepo.updateTransaction(db, chatId, id, {
        amount: patch.amount !== undefined ? Math.abs(patch.amount) : current.amount,
        type: patch.type ?? current.type,
        note: patch.note !== undefined ? patch.note : (current.note ?? null)
      })

      const summary = await ledgerRepo.getSummary(db, chatId)
      await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async deleteTransactions(chatId, ids) {
      await ledgerRepo.deleteTransactions(db, chatId, ids)

      const summary = await ledgerRepo.getSummary(db, chatId)
      if (ids.length) await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async refreshBalance(chatId: number) {
      if (!balancePublisher) {
        throw new Error("LEDGER_DISPLAY_NOT_CONFIGURED")
      }

      const summary = await ledgerRepo.getSummary(db, chatId)
      await balancePublisher.publishBalance(chatId, summary.net)
      return summary.net
    }
  }
}
