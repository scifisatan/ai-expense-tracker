import TelegramBot from 'node-telegram-bot-api';

export const createTelegramService = (bot: TelegramBot) => {
  return {
    async sendMessage(
      chatId: number,
      text: string,
      options?: TelegramBot.SendMessageOptions
    ) {
      return bot.sendMessage(chatId, text, options);
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

    async editMessageText(
      text: string,
      options: TelegramBot.EditMessageTextOptions
    ) {
      return bot.editMessageText(text, options);
    },

    async answerCallbackQuery(
      callbackQueryId: string,
      options?: Partial<TelegramBot.AnswerCallbackQueryOptions>
    ) {
      return bot.answerCallbackQuery(callbackQueryId, options);
    },

    async sendChatAction(chatId: number, action: TelegramBot.ChatAction) {
      return bot.sendChatAction(chatId, action);
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
