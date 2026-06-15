import type { Bot } from "grammy";
import type { BotContext } from "@bot/types";
import { getChatKeyboard, msg } from "../ui";

export const registerCallbackHandlers = (bot: Bot<BotContext>) => {
  const appUrl = (ctx: BotContext) =>
    ctx.env.APP_URL?.replace(/\/$/, "") ?? ctx.env.WEBHOOK_URL?.replace(/\/$/, "") ?? null;

  const sendRecentTransactions = async (ctx: BotContext, chatId: number) => {
    const { items } = await ctx.caller.transactions.list({ limit: 10 });

    if (!items.length) {
      await ctx.api.sendMessage(chatId, msg.noTransactions(), {
        reply_markup: getChatKeyboard(),
      });
      return;
    }

    await ctx.api.sendMessage(chatId, msg.recentTransactions(items), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  };

  const sendHelp = async (ctx: BotContext, chatId: number) => {
    await ctx.api.sendMessage(chatId, msg.help(), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  };

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.callbackQuery.message?.chat.id;

    if (!data || !chatId) return;

    if (data === "ui:help") {
      await ctx.answerCallbackQuery();
      await sendHelp(ctx, chatId);
      return;
    }

    if (!ctx.accountId) {
      await ctx.answerCallbackQuery();
      await ctx.api.sendMessage(chatId, msg.notLinked(appUrl(ctx)), {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    if (data === "ui:balance") {
      await ctx.answerCallbackQuery();
      await ctx.caller.ledger.refreshBalance();
      return;
    }

    if (data === "ui:transactions") {
      await ctx.answerCallbackQuery();
      await sendRecentTransactions(ctx, chatId);
      return;
    }
  });
};
