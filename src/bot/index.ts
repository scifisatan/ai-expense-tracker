import { Bot } from "grammy";
import type { Context } from "grammy";
import type { CloudflareBindings } from "../index";
import { registerHandlers } from "../adapters/telegram/bot-handlers";

export type BotContext = Context & {
  env: CloudflareBindings;
};

export const createBot = (env: CloudflareBindings) => {
  const token = env.BOT_TOKEN;
  if (!token) {
    throw new Error("Missing BOT_TOKEN binding");
  }

  const bot = new Bot<BotContext>(token);

  bot.use(async (ctx, next) => {
    ctx.env = env;

    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
    console.info("[update-received]", {
      updateId: ctx.update.update_id,
      chatId,
      userId,
      type: Object.keys(ctx.update).filter((k) => k !== "update_id")[0],
      text,
    });

    // Skip old updates (more than 2 minutes old)
    if (ctx.message && ctx.message.date) {
      const now = Math.floor(Date.now() / 1000);
      if (now - ctx.message.date > 120) {
        console.warn("[update-skipped] older than 2 minutes", {
          updateId: ctx.update.update_id,
          date: ctx.message.date,
          now,
        });
        return;
      }
    }

    await next();
  });

  registerHandlers(bot);
  return bot;
};
