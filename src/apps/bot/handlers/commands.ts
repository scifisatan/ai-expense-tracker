import type { Bot } from "grammy";
import type { BotContext } from "@bot/types";
import {
  BUTTON_BALANCE_RE,
  BUTTON_HELP_RE,
  BUTTON_TODAY_RE,
  BUTTON_TRANSACTIONS_RE,
  getChatKeyboard,
  msg,
} from "../ui";

const appUrl = (ctx: BotContext) =>
  ctx.env.APP_URL?.replace(/\/$/, "") ?? ctx.env.WEBHOOK_URL?.replace(/\/$/, "") ?? null;

// "8500 headphones" -> { price: 8500, title: "headphones" }. Used by /want
// and /need, which stay terse (no cooling-days/deadline args) by design.
const QUEUE_COMMAND_RE = /^(\d+(?:\.\d{1,2})?)\s+(.+)$/;

const parseQueueCommand = (text: unknown): { price: number; title: string } | null => {
  const match = QUEUE_COMMAND_RE.exec(String(text ?? "").trim());
  if (!match) return null;
  const price = Number(match[1]);
  const title = match[2]!.trim();
  if (!Number.isFinite(price) || price <= 0 || !title) return null;
  return { price, title };
};

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

  // Refresh the pinned balance and reply in-chat too — editing the pin alone is
  // invisible when the pinned message already exists.
  const sendBalance = async (ctx: BotContext) => {
    if (!(await requireLinked(ctx))) return;
    const { newBalance, currency } = await ctx.caller.ledger.refreshBalance();
    await ctx.reply(msg.balance(newBalance, currency), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  };

  bot.command("balance", sendBalance);

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

  const sendToday = async (ctx: BotContext) => {
    if (!(await requireLinked(ctx))) return;
    const snapshot = await ctx.caller.cycles.current();
    if (!snapshot.active) {
      await ctx.reply(msg.noCycle(), { reply_markup: getChatKeyboard() });
      return;
    }
    await ctx.reply(msg.today(snapshot), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  };

  bot.command("today", sendToday);

  const addQueueItem = async (ctx: BotContext, kind: "need" | "want") => {
    if (!(await requireLinked(ctx))) return;
    const parsed = parseQueueCommand(ctx.match);
    if (!parsed) {
      await ctx.reply(msg.queueUsage(kind));
      return;
    }

    try {
      const { item } = await ctx.caller.queue.create({
        kind,
        title: parsed.title,
        price: parsed.price,
      });
      await ctx.reply(msg.queueAdded(item), {
        parse_mode: "Markdown",
        reply_markup: getChatKeyboard(),
      });
    } catch (e) {
      console.error("[queue-add-error]", e);
      await ctx.reply(msg.genericError());
    }
  };

  bot.command("want", (ctx) => addQueueItem(ctx, "want"));
  bot.command("need", (ctx) => addQueueItem(ctx, "need"));

  bot.command("queue", async (ctx) => {
    if (!(await requireLinked(ctx))) return;
    const [wants, needs] = await Promise.all([
      ctx.caller.queue.list({ kind: "want" }),
      ctx.caller.queue.list({ kind: "need" }),
    ]);
    await ctx.reply(msg.queueList(wants.items, needs.items), {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard(),
    });
  });

  // Slash alias for the inline "↩️ Undo" button — undoes the single most
  // recent transaction. Ambiguous if other activity happened since (documented
  // in /help rather than solved with session state).
  bot.command("undo", async (ctx) => {
    if (!(await requireLinked(ctx))) return;
    const { items } = await ctx.caller.transactions.list({ limit: 1 });
    if (!items.length) {
      await ctx.reply(msg.noTransactions(), { reply_markup: getChatKeyboard() });
      return;
    }
    await ctx.caller.transactions.delete({ ids: [items[0]!.id] });
    await ctx.reply(msg.undone(), { reply_markup: getChatKeyboard() });
  });

  bot.hears(BUTTON_BALANCE_RE, sendBalance);

  bot.hears(BUTTON_TRANSACTIONS_RE, async (ctx) =>
    sendRecentTransactions(ctx, ctx.chat.id),
  );
  bot.hears(BUTTON_TODAY_RE, sendToday);
  bot.hears(BUTTON_HELP_RE, async (ctx) => sendHelp(ctx, ctx.chat.id));
};
