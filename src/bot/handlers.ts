import TelegramBot from "node-telegram-bot-api";
import createAIService from "@/services/ai";
import { log } from "@/config/logger";
import { computeTotals } from "@/bot/transactions";
import { createBalanceService } from "@/bot/balance";
import { createTelegramService } from "@/services/telegram";

export const registerHandlers = (bot: TelegramBot) => {
  const ai = createAIService();
  const telegram = createTelegramService(bot);
  const balanceService = createBalanceService(bot);

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await balanceService.sendAndPinBalance(chatId, 0);
    } catch (e) {
      console.error("[start-balance-error]", e);
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    // Remove Telegram's "pinned message" service notifications to keep chat clean.
    if (msg.pinned_message) {
      try {
        await telegram.deleteMessage(chatId, msg.message_id);
      } catch {
        // Ignore if we can't delete (permissions, etc.)
      }
      return;
    }

    if (msg.from?.is_bot) return; // avoid pinning bot/system messages

    // Prefer text; fall back to caption for media messages.
    const text = (msg.text ?? msg.caption ?? "").trim();
    if (!text) return;

    try {
      const start = Date.now();
      log.debug("[extract-input]", text);
      const extracted = await ai.extractTransactions(text);
      const duration = Date.now() - start;
      log.debug("[extract-output]", extracted, `(${duration}ms)`);

      if (!extracted.items.length) return;

      const { net } = computeTotals(extracted.items);

      const { balance: currentBalance } = await balanceService.getPinnedBalance(
        chatId
      );
      if (currentBalance === null) {
        log.debug("[balance-skip] no pinned balance; ignoring message");
        return;
      }

      const newBalance = currentBalance + net;

      try {
        const pinnedMessageId = await balanceService.sendAndPinBalance(
          chatId,
          newBalance
        );
        log.info(
          "[balance] prev=",
          currentBalance,
          "new=",
          newBalance,
          "net=",
          net,
          "pinnedMessageId=",
          pinnedMessageId
        );
      } catch (e) {
        console.error("[balance-pin-error]", e);
      }
    } catch (err) {
      log.error("[extract-error]", err);
      return;
    }
  });
};
