import type { Bot } from "grammy";
import type { BotContext } from "@bot/types";
import {
  BUTTON_BALANCE_RE,
  BUTTON_HELP_RE,
  BUTTON_TRANSACTIONS_RE,
  getChatKeyboard,
  msg,
} from "../ui";

const appUrl = (ctx: BotContext) =>
  ctx.env.APP_URL?.replace(/\/$/, "") ?? ctx.env.WEBHOOK_URL?.replace(/\/$/, "") ?? null;

// Replies with the connect-account instructions when the chat is not linked.
const requireLinked = async (ctx: BotContext): Promise<boolean> => {
  if (ctx.accountId) return true;
  await ctx.reply(msg.notLinked(appUrl(ctx)), {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
  return false;
};

export const registerCommandHandlers = (bot: Bot<BotContext>) => {
  const sendHelp = async (ctx: BotContext, chatId: number) => {
    await ctx.api.sendMessage(chatId, msg.help(), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  };

  const sendRecentTransactions = async (ctx: BotContext, chatId: number) => {
    if (!(await requireLinked(ctx))) return;

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

  bot.command("start", async (ctx) => {
    if (!(await requireLinked(ctx))) return;

    try {
      await ctx.caller.ledger.refreshBalance();

      await ctx.reply(msg.started(), {
        parse_mode: "Markdown",
        reply_markup: getChatKeyboard(),
      });
    } catch (e) {
      console.error("[start-balance-error]", e);
      await ctx.reply(msg.startError());
    }
  });

  bot.command("link", async (ctx) => {
    const { code, expiresInSeconds } = await ctx.caller.telegram.requestLinkCode();
    await ctx.reply(msg.linkCode(code, expiresInSeconds, appUrl(ctx)), {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command("app", async (ctx) => {
    await ctx.reply(msg.appLink(appUrl(ctx)), {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command("balance", async (ctx) => {
    if (!(await requireLinked(ctx))) return;
    await ctx.caller.ledger.refreshBalance();
  });

  bot.command("transactions", async (ctx) =>
    sendRecentTransactions(ctx, ctx.chat.id),
  );

  bot.command("month", async (ctx) => {
    if (!(await requireLinked(ctx))) return;
    const summary = await ctx.caller.insights.summary({ period: "month" });
    await ctx.api.sendMessage(ctx.chat.id, msg.monthSummary(summary, summary.currency), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  });

  bot.command("help", async (ctx) => sendHelp(ctx, ctx.chat.id));

  bot.hears(BUTTON_BALANCE_RE, async (ctx) => {
    if (!(await requireLinked(ctx))) return;
    await ctx.caller.ledger.refreshBalance();
  });

  bot.hears(BUTTON_TRANSACTIONS_RE, async (ctx) =>
    sendRecentTransactions(ctx, ctx.chat.id),
  );
  bot.hears(BUTTON_HELP_RE, async (ctx) => sendHelp(ctx, ctx.chat.id));
};
