import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransactionManager } from "../src/application/transaction-manager";

const mockAI = {
  extractTransactions: vi.fn(),
};

const mockLedger = {
  refreshBalance: vi.fn(),
  addTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransactions: vi.fn(),
};

vi.mock("../src/application/ai", () => ({
  createAIService: () => mockAI,
}));

describe("TransactionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const manager = createTransactionManager({
    aiModel: "test-model",
    ledger: mockLedger as any,
  });

  it("refreshPinnedBalance delegates to ledger", async () => {
    mockLedger.refreshBalance.mockResolvedValueOnce(500);

    const balance = await manager.refreshPinnedBalance(123);

    expect(balance).toBe(500);
    expect(mockLedger.refreshBalance).toHaveBeenCalledWith(123);
  });

  it("processUserMessage saves transactions via ledger and returns projection", async () => {
    mockAI.extractTransactions.mockResolvedValueOnce({
      items: [
        { amount: 50, type: "Expense", note: "Coffee" },
        { amount: 100, type: "Income", note: "Gift" },
      ],
    });
    mockLedger.addTransactions.mockResolvedValueOnce({ newBalance: 50 });

    const result = await manager.processUserMessage(
      123,
      456,
      "spent 50 on coffee and got 100",
      "key",
    );

    expect(result).not.toBeNull();
    expect(result?.net).toBe(50);
    expect(result?.newBalance).toBe(50);
    expect(mockLedger.addTransactions).toHaveBeenCalled();
  });

  it("processUserMessage returns null if no transactions extracted", async () => {
    mockAI.extractTransactions.mockResolvedValueOnce({ items: [] });

    const result = await manager.processUserMessage(123, 456, "hello", "key");

    expect(result).toBeNull();
  });
});
