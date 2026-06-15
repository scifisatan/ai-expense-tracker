import { z } from "zod"
import type { Transaction, NewTransaction } from '@/db/schema'

// Telegram linking (bot issues a code, web confirms it while authenticated)
export const confirmLinkInputSchema = z.object({
  code: z.string().trim().min(4).max(16)
})

export type ConfirmLinkInput = z.infer<typeof confirmLinkInputSchema>

// Ledger / transaction types
export const transactionTypeSchema = z.enum(["Income", "Expense"])

export type TransactionType = "Income" | "Expense"

export const transactionsListInputSchema = z.object({
  limit: z.number().min(1).max(200).default(50)
})

// Manual entry from the web. Amount is a major-unit decimal; converted to minor units server-side.
export const transactionsCreateInputSchema = z.object({
  amount: z.number().positive(),
  type: transactionTypeSchema,
  currency: z.string().min(3).max(3).optional(),
  categoryId: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  occurredAt: z.string().optional()
})

export const transactionsUpdateInputSchema = z.object({
  id: z.number(),
  amount: z.number().positive().optional(),
  type: transactionTypeSchema.optional(),
  currency: z.string().min(3).max(3).optional(),
  categoryId: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  occurredAt: z.string().optional()
})

export const transactionsDeleteInputSchema = z.object({
  ids: z.array(z.number())
})

// Category CRUD
export const categoryCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: transactionTypeSchema,
  color: z.string().nullable().optional()
})

export const categoryUpdateInputSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1).max(64).optional(),
  type: transactionTypeSchema.optional(),
  color: z.string().nullable().optional()
})

export const categoryDeleteInputSchema = z.object({
  id: z.number()
})

// Settings
export const settingsUpdateInputSchema = z.object({
  groqApiKey: z.string().nullable().optional(),
  defaultCurrency: z.string().min(3).max(3).optional()
})

export type LedgerTransaction = Transaction

export type BalanceProjection = {
  income: number
  expense: number
  net: number
  transactions: number
}

// Normalized item ready for insertion (amount already in minor units).
export type NewLedgerTransaction = Pick<NewTransaction, 'amountMinor' | 'type' | 'note' | 'currency' | 'categoryId'>

// AI extraction contract. The model returns major-unit decimal amounts; the server
// converts them to minor units before insertion.
export const transactionItemSchema = z.object({
  amount: z.number().describe("Transaction amount as a positive decimal (major units)"),
  type: z.enum(["Expense", "Income"]).describe("Money flow direction"),
  note: z.string().describe("Note describing the specific transaction"),
  category: z.string().optional().describe("Optional category hint, e.g. 'Food', 'Transport'")
})

export const transactionsSchema = z.object({
  items: z
    .array(transactionItemSchema)
    .describe("List of all transactions mentioned; empty if none")
})

export type TransactionItem = z.infer<typeof transactionItemSchema>
export type TransactionsExtraction = z.infer<typeof transactionsSchema>
