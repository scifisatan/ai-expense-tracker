import type { TransactionType } from "@/shared/types"

type LedgerAmount = {
  amount: number
  type: TransactionType
}

export const computeLedgerTotals = (items: LedgerAmount[]) => {
  const totalIncome = items
    .filter((item) => item.type === "Income")
    .reduce((sum, item) => sum + item.amount, 0)
  const totalExpense = items
    .filter((item) => item.type === "Expense")
    .reduce((sum, item) => sum + item.amount, 0)

  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense
  }
}
