import type { LedgerRepository } from "@/shared/service/database-service"
import type {
  BalanceProjection,
  LedgerTransaction,
  LedgerTransactionPatch,
  NewLedgerTransaction
} from "@/shared/types/ledger"

export type LedgerBalancePublisher = {
  publishBalance(chatId: number, balance: number): Promise<void>
}

type LedgerServiceDeps = {
  balancePublisher?: LedgerBalancePublisher
  ledgerRepository: LedgerRepository
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

export const createLedgerService = (deps: LedgerServiceDeps): LedgerService => {
  const publishBalance = async (chatId: number, balance: number) => {
    await deps.balancePublisher?.publishBalance(chatId, balance)
  }

  return {
    async listRecent(chatId: number, limit = 10) {
      return deps.ledgerRepository.listRecent(chatId, limit)
    },

    async getSummary(chatId: number) {
      return deps.ledgerRepository.getSummary(chatId)
    },

    async addTransactions(chatId, userId, items, fallbackNote) {
      if (items.length) {
        await deps.ledgerRepository.insertTransactions(chatId, userId, items, fallbackNote)
      }

      const summary = await deps.ledgerRepository.getSummary(chatId)
      if (items.length) await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async updateTransaction(chatId, id, patch) {
      const current = await deps.ledgerRepository.findTransaction(chatId, id)
      if (!current) throw new Error("TRANSACTION_NOT_FOUND")

      await deps.ledgerRepository.updateTransaction(chatId, id, {
        amount: patch.amount !== undefined ? Math.abs(patch.amount) : current.amount,
        type: patch.type ?? current.type,
        note: patch.note !== undefined ? patch.note : current.note
      })

      const summary = await deps.ledgerRepository.getSummary(chatId)
      await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async deleteTransactions(chatId, ids) {
      await deps.ledgerRepository.deleteTransactions(chatId, ids)

      const summary = await deps.ledgerRepository.getSummary(chatId)
      if (ids.length) await publishBalance(chatId, summary.net)
      return { newBalance: summary.net }
    },

    async refreshBalance(chatId: number) {
      if (!deps.balancePublisher) {
        throw new Error("LEDGER_DISPLAY_NOT_CONFIGURED")
      }

      const summary = await deps.ledgerRepository.getSummary(chatId)
      await deps.balancePublisher.publishBalance(chatId, summary.net)
      return summary.net
    }
  }
}

export { computeLedgerTotals } from "./totals"
