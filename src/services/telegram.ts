import type { Api } from "grammy";

export const createTelegramService = (api: Api) => {
  return {
    async sendMessage(chatId: number, text: string, options?: any) {
      return api.sendMessage(chatId, text, options);
    },

    async pinMessage(chatId: number, messageId: number, disableNotification = true) {
      return api.pinChatMessage(chatId, messageId, {
        disable_notification: disableNotification,
      });
    },

    async deleteMessage(chatId: number, messageId: number) {
      return api.deleteMessage(chatId, messageId);
    },

    async editMessageText(chatId: number, messageId: number, text: string, options?: any) {
      return api.editMessageText(chatId, messageId, text, options);
    },

    async answerCallbackQuery(callbackQueryId: string, options?: any) {
      return api.answerCallbackQuery(callbackQueryId, options);
    },

    async sendChatAction(chatId: number, action: any) {
      return api.sendChatAction(chatId, action);
    },

    async getChat(chatId: number) {
      return api.getChat(chatId);
    },
  };
};
