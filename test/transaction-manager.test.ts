import { describe, it, expect, vi } from "vitest";
import { createTransactionManager } from "../src/services/transaction-manager";

// Mock dependencies
const mockStore = {
  listRecent: vi.fn(),
  addMany: vi.fn(),
};

const mockAI = {
  extractTransactions: vi.fn(),
};

const mockDisplay = {
  updateBalance: vi.fn(),
};

vi.mock("../src/storage/transaction-store", () => ({
  createTransactionStore: () => mockStore,
}));

vi.mock("../src/services/ai", () => ({
  createAIService: () => mockAI,
}));

describe("TransactionManager", () => {
  const config = {
    db: {} as any, // D1 is mocked via store
    aiModel: "test-model",
    display: mockDisplay,
  };

  const manager = createTransactionManager(config);

  it("refreshPinnedBalance calculates balance from history and updates display", async () => {
    mockStore.listRecent.mockResolvedValue([
      { amount: 1000, type: "Income" },
      { amount: 200, type: "Expense" },
      { amount: 300, type: "Expense" },
    ]);

    const balance = await manager.refreshPinnedBalance(123);
    
    expect(balance).toBe(500);
    expect(mockDisplay.updateBalance).toHaveBeenCalledWith(123, 500);
  });

  it("processUserMessage saves transactions and updates balance", async () => {
    mockAI.extractTransactions.mockResolvedValueOnce({
      items: [
        { amount: 50, type: "Expense", note: "Coffee" },
        { amount: 100, type: "Income", note: "Gift" },
      ],
    });
    mockStore.listRecent.mockResolvedValueOnce([]); // Start from zero

    const result = await manager.processUserMessage(123, 456, "spent 50 on coffee and got 100", "key");

    expect(result).not.toBeNull();
    expect(result?.net).toBe(50);
    expect(result?.newBalance).toBe(50);
    expect(mockStore.addMany).toHaveBeenCalled();
    expect(mockDisplay.updateBalance).toHaveBeenCalledWith(123, 50);
  });

  it("processUserMessage returns null if no transactions extracted", async () => {
    mockAI.extractTransactions.mockResolvedValueOnce({ items: [] });
    
    const result = await manager.processUserMessage(123, 456, "hello", "key");
    
    expect(result).toBeNull();
  });
});
