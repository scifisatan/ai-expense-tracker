import type { Api } from "grammy";
import { parseBalance } from "../utils/parser";
import type { BalanceInfo } from "./types";

export const createBalanceService = (api: Api) => {
  return {
    async getPinnedBalance(chatId: number): Promise<BalanceInfo> {
      try {
        const chatInfo = await api.getChat(chatId);
        const pinned = (chatInfo as any).pinned_message;

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
      const balanceText = `💰 Current Balance: Rs. ${balance}`;
      const balanceMsg = await api.sendMessage(chatId, balanceText);
      await api.pinChatMessage(chatId, balanceMsg.message_id, {
        disable_notification: true,
      });
      return balanceMsg.message_id;
    },
  };
};

export type BalanceService = ReturnType<typeof createBalanceService>;
