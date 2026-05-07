import { createAiService } from "@/shared/service/ai-service"
import { createTelegramAuthService } from "@/shared/service/auth-service"
import { createDatabaseService } from "@/shared/service/database-service"
import { createLedgerService, type LedgerBalancePublisher } from "@/shared/service/ledger-service"
import { createTelegramBotService } from "@/shared/service/telegram-bot-service"

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

type AppRuntimeEnv = {
  AI_MODEL?: string
  BOT_TOKEN?: string
}

type AppContextConfig = {
  db: D1Database
  env: AppRuntimeEnv
  telegram?: {
    balancePublisher?: LedgerBalancePublisher
    botToken?: string
  }
}

export const createAppContext = (config: AppContextConfig) => {
  const { db, env, telegram } = config
  const botToken = telegram?.botToken ?? env.BOT_TOKEN
  const authSecret = env.BOT_TOKEN ?? botToken ?? ""
  const database = createDatabaseService(db)
  const ai = createAiService({ model: env.AI_MODEL ?? DEFAULT_MODEL })

  const ledger = createLedgerService({
    balancePublisher: telegram?.balancePublisher,
    ledgerRepository: database.ledger
  })

  const telegramBot = createTelegramBotService({
    ai,
    ledger,
    userSettings: database.userSettings,
    users: database.users
  })

  const createOtpAuth = () => {
    return createTelegramAuthService({
      botToken,
      authSecret
    })
  }

  return {
    ledger,
    telegramBot,
    createOtpAuth
  }
}

export type AppContext = ReturnType<typeof createAppContext>
