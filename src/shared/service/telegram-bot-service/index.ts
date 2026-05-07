import type { AiService } from "@/shared/service/ai-service"
import type {
  TelegramUserRecord,
  UserRepository,
  UserSettingsRepository
} from "@/shared/service/database-service"
import { computeLedgerTotals, type LedgerService } from "@/shared/service/ledger-service"
import type { NewLedgerTransaction, TransactionItem, TransactionType } from "@/shared/types/ledger"

type TelegramBotServiceDeps = {
  ai: AiService
  ledger: LedgerService
  userSettings: UserSettingsRepository
  users: UserRepository
}

const normalizeExtractedTransaction = (item: TransactionItem): NewLedgerTransaction => ({
  amount: Math.abs(item.amount),
  type: item.type as TransactionType,
  note: item.note
})

export type TelegramBotService = {
  getGroqApiKey(userId: number): Promise<string | null>
  listRecentTransactions(chatId: number, limit?: number): ReturnType<LedgerService["listRecent"]>
  processUserMessage(
    chatId: number,
    userId: number,
    text: string,
    groqKey: string
  ): Promise<{ items: NewLedgerTransaction[]; net: number; newBalance: number } | null>
  refreshPinnedBalance(chatId: number): Promise<number>
  registerUser(user: TelegramUserRecord): Promise<void>
  removeGroqApiKey(userId: number): Promise<void>
  setGroqApiKey(userId: number, apiKey: string): Promise<void>
}

export const createTelegramBotService = (deps: TelegramBotServiceDeps): TelegramBotService => {
  return {
    async registerUser(user: TelegramUserRecord) {
      await deps.users.saveTelegramUser(user)
    },

    async getGroqApiKey(userId: number) {
      return deps.userSettings.getGroqApiKey(userId)
    },

    async setGroqApiKey(userId: number, apiKey: string) {
      await deps.userSettings.setGroqApiKey(userId, apiKey)
    },

    async removeGroqApiKey(userId: number) {
      await deps.userSettings.removeGroqApiKey(userId)
    },

    async listRecentTransactions(chatId: number, limit = 10) {
      return deps.ledger.listRecent(chatId, limit)
    },

    async refreshPinnedBalance(chatId: number) {
      return deps.ledger.refreshBalance(chatId)
    },

    async processUserMessage(chatId: number, userId: number, text: string, groqKey: string) {
      const extracted = await deps.ai.extractTransactions(text, groqKey)
      if (!extracted.items.length) return null

      const normalizedItems = extracted.items.map(normalizeExtractedTransaction)
      const { net } = computeLedgerTotals(normalizedItems)
      const { newBalance } = await deps.ledger.addTransactions(
        chatId,
        userId,
        normalizedItems,
        text
      )

      return {
        items: normalizedItems,
        net,
        newBalance
      }
    }
  }
}

export {
  createTelegramBalancePublisher,
  createTelegramBalanceService,
  parseTelegramBalanceMessage
} from "./balance-message"
export type { TelegramBalanceInfo, TelegramBalanceService } from "./balance-message"
