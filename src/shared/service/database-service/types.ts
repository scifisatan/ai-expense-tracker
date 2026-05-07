import type {
  BalanceProjection,
  LedgerTransaction,
  NewLedgerTransaction,
  TransactionType
} from "@/shared/types/ledger"

export type TelegramUserRecord = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

export type UserRecord = {
  userId: number
  username: string | null
  firstName: string | null
  lastName: string | null
}

export type LedgerTransactionUpdate = {
  amount: number
  type: TransactionType
  note: string | null
}

export type UserRepository = {
  saveTelegramUser(user: TelegramUserRecord): Promise<void>
  findByUserId(userId: number): Promise<UserRecord | null>
}

export type UserSettingsRepository = {
  getGroqApiKey(userId: number): Promise<string | null>
  setGroqApiKey(userId: number, apiKey: string): Promise<void>
  removeGroqApiKey(userId: number): Promise<void>
}

export type LedgerRepository = {
  listRecent(chatId: number, limit?: number): Promise<LedgerTransaction[]>
  getSummary(chatId: number): Promise<BalanceProjection>
  insertTransactions(
    chatId: number,
    userId: number,
    items: NewLedgerTransaction[],
    fallbackNote?: string
  ): Promise<void>
  findTransaction(chatId: number, id: number): Promise<LedgerTransaction | null>
  updateTransaction(chatId: number, id: number, patch: LedgerTransactionUpdate): Promise<void>
  deleteTransactions(chatId: number, ids: number[]): Promise<void>
}

export type DatabaseService = {
  users: UserRepository
  userSettings: UserSettingsRepository
  ledger: LedgerRepository
}
