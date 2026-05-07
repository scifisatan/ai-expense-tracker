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
