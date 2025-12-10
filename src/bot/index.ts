import TelegramBot from "node-telegram-bot-api";
import { BOT_TOKEN } from "@/config/env";
import { registerHandlers } from "@/bot/handlers";

export const createBot = (
  token: string,
  options?: TelegramBot.ConstructorOptions
) => {
  const bot = new TelegramBot(token, { polling: false, ...(options ?? {}) });
  registerHandlers(bot);
  return bot;
};

const bot = createBot(BOT_TOKEN);
export { bot };
