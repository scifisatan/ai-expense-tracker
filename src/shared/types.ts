import { z } from "zod"
import type { Transaction, NewTransaction } from '@/db/schema'

// Auth Types
export const authIdentifierSchema = z.object({
  username: z.string().optional(),
  chatId: z.number().optional()
})

export const requestOtpInputSchema = authIdentifierSchema

export const verifyOtpInputSchema = authIdentifierSchema.extend({
  otp: z.string(),
  challengeToken: z.string()
})

export type AuthIdentifier = z.infer<typeof authIdentifierSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpInputSchema>

// Ledger Types
export const transactionTypeSchema = z.enum(["Income", "Expense"])

export const transactionsListInputSchema = z.object({
  limit: z.number().min(1).max(200).default(50)
})

export const transactionsUpdateInputSchema = z.object({
  id: z.number(),
  amount: z.number().optional(),
  type: transactionTypeSchema.optional(),
  note: z.string().nullable().optional()
})

export const transactionsDeleteInputSchema = z.object({
  ids: z.array(z.number())
})

export type TransactionType = "Income" | "Expense"

export type LedgerTransaction = Transaction

export type BalanceProjection = {
  income: number
  expense: number
  net: number
  transactions: number
}

export type NewLedgerTransaction = Pick<NewTransaction, 'amount' | 'type' | 'note'>

export type LedgerTransactionPatch = Partial<NewLedgerTransaction>

export const transactionItemSchema = z.object({
  amount: z.number().int().describe("Transaction amount as positive integer"),
  type: z.enum(["Expense", "Income"]).describe("Money flow direction"),
  note: z.string().describe("Note related to the transaction")
})

export const transactionsSchema = z.object({
  items: z
    .array(transactionItemSchema)
    .describe("List of all transactions mentioned; empty if none")
})

export type TransactionItem = z.infer<typeof transactionItemSchema>
export type TransactionsExtraction = z.infer<typeof transactionsSchema>
