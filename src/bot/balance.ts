import { createTelegramService } from "@/services/telegram";
import type TelegramBot from "node-telegram-bot-api";
import { parseBalance } from "@/utils/parser";
import type { BalanceInfo } from "@/bot/types";

export const createBalanceService = (bot: TelegramBot) => {
  const ts = createTelegramService(bot);

  return {
    async getPinnedBalance(chatId: number): Promise<BalanceInfo> {
      try {
        const chatInfo = await ts.getChat(chatId);
        const pinned = (chatInfo as any).pinned_message as
          | TelegramBot.Message
          | undefined;
        if (pinned?.text) {
          const parsed = parseBalance(pinned.text);
          if (parsed !== null) {
            return { balance: parsed, messageId: pinned.message_id };
          }
        }
      } catch (e) {
        console.error("[balance-fetch-error]", e);
      }
      return { balance: null };
    },

    async sendAndPinBalance(chatId: number, balance: number) {
      const balanceText = `Remaining Balance: Rs. ${balance}`;
      const balanceMsg = await ts.sendMessage(chatId, balanceText);
      await ts.pinMessage(chatId, balanceMsg.message_id, true);
      return balanceMsg.message_id;
    },
  };
};

export type BalanceService = ReturnType<typeof createBalanceService>;
