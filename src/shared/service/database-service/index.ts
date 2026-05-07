import { createLedgerRepository } from "./ledger-repository"
import { createUserRepository } from "./user-repository"
import { createUserSettingsRepository } from "./user-settings-repository"
import type { DatabaseService } from "./types"

export const createDatabaseService = (db: D1Database): DatabaseService => ({
  users: createUserRepository(db),
  userSettings: createUserSettingsRepository(db),
  ledger: createLedgerRepository(db)
})

export type {
  DatabaseService,
  LedgerRepository,
  LedgerTransactionUpdate,
  TelegramUserRecord,
  UserRecord,
  UserRepository,
  UserSettingsRepository
} from "./types"
