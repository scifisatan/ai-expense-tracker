import { z } from "zod";

export const transactionTypeSchema = z.enum(["Income", "Expense"]);

export const transactionsListInputSchema = z.object({
  limit: z.number().min(1).max(200).default(50),
});

export const transactionsUpdateInputSchema = z.object({
  id: z.number(),
  amount: z.number().optional(),
  type: transactionTypeSchema.optional(),
  note: z.string().nullable().optional(),
});

export const transactionsDeleteInputSchema = z.object({
  ids: z.array(z.number()),
});


export type TransactionType = "Income" | "Expense";

export type LedgerTransaction = {
  id: number;
  chatId: number;
  amount: number;
  type: TransactionType;
  note: string | null;
  createdAt: string;
};

export type BalanceProjection = {
  income: number;
  expense: number;
  net: number;
  transactions: number;
};

export type NewLedgerTransaction = {
  amount: number;
  type: TransactionType;
  note?: string | null;
};

export type LedgerTransactionPatch = {
  amount?: number;
  type?: TransactionType;
  note?: string | null;
};