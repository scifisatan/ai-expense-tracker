import type { TransactionItem } from "@bot/types";

export const computeTotals = (items: TransactionItem[]) => {
  const totalIncome = items
    .filter((i) => i.type === "Income")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = items
    .filter((i) => i.type === "Expense")
    .reduce((sum, i) => sum + i.amount, 0);
  return { totalIncome, totalExpense, net: totalIncome - totalExpense };
};
