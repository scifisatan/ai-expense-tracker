import { Api } from "grammy";
import type { LedgerDisplay } from "./interface";
import { createBalanceService } from "../../bot/balance";

export class TelegramLedgerAdapter implements LedgerDisplay {
  private balanceService: ReturnType<typeof createBalanceService>;

  constructor(botToken: string) {
    const api = new Api(botToken);
    this.balanceService = createBalanceService(api);
  }

  async updateBalance(chatId: number, balance: number): Promise<void> {
    // The adapter handles the domain-specific formatting (emojis, currency symbols)
    // and the technical implementation (Telegram pinning/editing logic)
    await this.balanceService.sendAndPinBalance(chatId, balance);
  }
}
