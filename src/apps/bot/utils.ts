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

export const parseBalance = (text: string): number | null => {
  const cleaned = text.trim();

  // 1. Check for "Balance" related keywords
  const balanceMatch = cleaned.match(
    /(?:remaining|current|total)?\s*balance\s*:?\s*r?s?\.?\s*(-?[\d,.]+)/i,
  );
  if (balanceMatch?.[1]) {
    const val = Number(balanceMatch[1].replace(/,/g, ""));
    if (!isNaN(val)) return val;
  }

  // 2. Check for just "Rs." prefix
  const matchRs = cleaned.match(/rs\.?\s*(-?[\d,.]+)/i);
  if (matchRs?.[1]) {
    const val = Number(matchRs[1].replace(/,/g, ""));
    if (!isNaN(val)) return val;
  }

  return null;
};
