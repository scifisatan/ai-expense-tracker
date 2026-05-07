import { describe, it, expect, vi } from "vitest";
import { createLedgerModule } from "../src/domain/ledger";

const createRepo = (overrides: Partial<any> = {}) => ({
  listRecent: vi.fn().mockResolvedValue([]),
  getSummary: vi.fn().mockResolvedValue({ income: 0, expense: 0, net: 0, transactions: 0 }),
  addMany: vi.fn().mockResolvedValue(undefined),
  getById: vi.fn().mockResolvedValue(null),
  updateById: vi.fn().mockResolvedValue(undefined),
  deleteMany: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("LedgerModule", () => {
  it("delegates listRecent to repo", async () => {
    const repo = createRepo({
      listRecent: vi.fn().mockResolvedValue([
        {
          id: 1,
          chatId: 123,
          amount: 100,
          type: "Income",
          note: "gift",
          createdAt: "2026-01-01",
        },
      ]),
    });

    const module = createLedgerModule({ repo });
    const items = await module.listRecent(123, 10);

    expect(repo.listRecent).toHaveBeenCalledWith(123, 10);
    expect(items).toHaveLength(1);
  });

  it("returns summary from repo", async () => {
    const repo = createRepo({
      getSummary: vi
        .fn()
        .mockResolvedValue({ income: 1000, expense: 400, net: 600, transactions: 4 }),
    });

    const module = createLedgerModule({ repo });
    const summary = await module.getSummary(123);

    expect(summary.net).toBe(600);
  });

  it("addTransactions persists and returns refreshed balance", async () => {
    const repo = createRepo({
      getSummary: vi
        .fn()
        .mockResolvedValue({ income: 1000, expense: 900, net: 100, transactions: 2 }),
    });

    const module = createLedgerModule({ repo });
    const result = await module.addTransactions(123, 456, [
      { amount: 50, type: "Expense", note: "tea" },
    ]);

    expect(repo.addMany).toHaveBeenCalled();
    expect(result.newBalance).toBe(100);
  });

  it("updateTransaction throws when transaction does not exist", async () => {
    const repo = createRepo({ getById: vi.fn().mockResolvedValue(null) });
    const module = createLedgerModule({ repo });

    await expect(module.updateTransaction(123, 999, { amount: 10 })).rejects.toThrow(
      "TRANSACTION_NOT_FOUND",
    );
  });

  it("refreshBalance updates display with net balance", async () => {
    const repo = createRepo({
      getSummary: vi
        .fn()
        .mockResolvedValue({ income: 1000, expense: 900, net: 100, transactions: 2 }),
    });
    const display = {
      updateBalance: vi.fn().mockResolvedValue(undefined),
    };

    const module = createLedgerModule({ repo, display });
    const balance = await module.refreshBalance(999);

    expect(balance).toBe(100);
    expect(display.updateBalance).toHaveBeenCalledWith(999, 100);
  });

  it("throws if refreshBalance is called without display adapter", async () => {
    const repo = createRepo();
    const module = createLedgerModule({ repo });

    await expect(module.refreshBalance(1)).rejects.toThrow("LEDGER_DISPLAY_NOT_CONFIGURED");
  });
});
