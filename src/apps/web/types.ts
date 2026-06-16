import type { inferRouterOutputs } from "@trpc/server"
import type { APIRouter } from "@api/router"
import type { TransactionType } from "@/shared/types"

type RouterOutput = inferRouterOutputs<APIRouter>

type SessionResponse = RouterOutput["auth"]["session"]
type Transaction = RouterOutput["transactions"]["list"]["items"][number]
type Summary = RouterOutput["insights"]["summary"]
type Category = RouterOutput["categories"]["list"]["items"][number]
type TelegramLink = RouterOutput["telegram"]["listLinks"]["items"][number]

type TxUpdatePatch = {
  amount?: number
  type?: TransactionType
  note?: string | null
  categoryId?: number | null
}

type SortKey = "id" | "amountMinor" | "type" | "occurredAt"
type SortDir = "asc" | "desc"

export type { SessionResponse, Transaction, Summary, Category, TelegramLink, TxUpdatePatch, SortKey, SortDir }
