import type { TransactionItem } from "@/bot/types";

export const computeTotals = (items: TransactionItem[]) => {
  const totalDeposit = items
    .filter((i) => i.type === "Deposit")
    .reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = items
    .filter((i) => i.type === "Expense")
    .reduce((sum, i) => sum + i.amount, 0);
  return { totalDeposit, totalExpense, net: totalDeposit - totalExpense };
};
