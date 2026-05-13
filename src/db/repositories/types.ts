import type { TransactionType } from "@/shared/types"

export type LedgerTransactionUpdate = {
  amount: number
  type: TransactionType
  note: string | null
}

export type TelegramUserRecord = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}
