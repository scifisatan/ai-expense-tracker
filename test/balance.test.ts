import { describe, it, expect, vi } from "vitest";
import { createBalanceService } from "../src/bot/balance";

describe("balance service", () => {
  it("returns null if no pinned message exists", async () => {
    const mockApi = {
      getChat: vi.fn().mockResolvedValue({}),
    };
    const service = createBalanceService(mockApi as any);
    const result = await service.getPinnedBalance(123);
    expect(result.balance).toBeNull();
  });

  it("parses balance from pinned message text", async () => {
    const mockApi = {
      getChat: vi.fn().mockResolvedValue({
        pinned_message: {
          text: "Current Balance: Rs. 1,500",
          message_id: 456,
        },
      }),
    };
    const service = createBalanceService(mockApi as any);
    const result = await service.getPinnedBalance(123);
    expect(result.balance).toBe(1500);
    expect(result.messageId).toBe(456);
  });

  it("sends and pins balance", async () => {
    const mockApi = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 789 }),
      pinChatMessage: vi.fn().mockResolvedValue(true),
    };
    const service = createBalanceService(mockApi as any);
    const messageId = await service.sendAndPinBalance(123, 2000);

    expect(mockApi.sendMessage).toHaveBeenCalledWith(123, expect.stringContaining("2000"));
    expect(mockApi.pinChatMessage).toHaveBeenCalledWith(123, 789, { disable_notification: true });
    expect(messageId).toBe(789);
  });

  it("returns null and logs error on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockApi = {
      getChat: vi.fn().mockRejectedValue(new Error("Network Error")),
    };
    const service = createBalanceService(mockApi as any);
    const result = await service.getPinnedBalance(123);

    expect(result.balance).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
