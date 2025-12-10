import TelegramBot from "node-telegram-bot-api";

export const createTelegramService = (bot: TelegramBot) => {
  return {
    async sendMessage(chatId: number, text: string) {
      return bot.sendMessage(chatId, text);
    },

    async pinMessage(
      chatId: number,
      messageId: number,
      disableNotification = true
    ) {
      return bot.pinChatMessage(chatId, messageId, {
        disable_notification: disableNotification,
      });
    },

    async deleteMessage(chatId: number, messageId: number) {
      return bot.deleteMessage(chatId, messageId);
    },

    async getChat(chatId: number) {
      return bot.getChat(chatId);
    },

    processUpdate(update: any) {
      return bot.processUpdate(update);
    },

    getBot() {
      return bot;
    },
  };
};
