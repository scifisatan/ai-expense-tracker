import { describe, it, expect } from 'bun:test';
import { computeTotals } from '../src/bot/transactions';

describe('computeTotals', () => {
  it('computes totals correctly', () => {
    const items = [
      { amount: 100, type: 'Deposit' },
      { amount: 40, type: 'Expense' },
      { amount: 30, type: 'Expense' },
      { amount: 200, type: 'Deposit' },
    ];

    const { totalDeposit, totalExpense, net } = computeTotals(items as any);
    expect(totalDeposit).toBe(300);
    expect(totalExpense).toBe(70);
    expect(net).toBe(230);
  });
});
