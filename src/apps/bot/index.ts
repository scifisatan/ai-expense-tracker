import { Bot } from "grammy";
import { Hono } from "hono";
import { createBotCaller } from "@api/caller";
import { createDb } from "@/db/client";
import { createRepositories } from "@api/repositories";
import { registerHandlers } from "@bot/handlers";
import { log } from "@/utils/logger";

import type { Update } from "grammy/types";
import type { BotContext } from "@bot/types";
import type { AppEnv } from "@apps/env";

const botRoutes = new Hono<AppEnv>();

botRoutes.post("/*", async (c) => {
  try {
    const update = (await c.req.json()) as Update;

    const token = c.env.BOT_TOKEN;
    const botInfo = await c.env.BOT_INFO.get("BOT_INFO");

    if (!token) {
      const errorMsg: string = "Missing BOT_TOKEN binding";
      log.bot.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!botInfo) {
      const errorMsg: string = "Missing BOT_INFO binding";
      log.bot.error(errorMsg, botInfo);
      throw new Error(errorMsg);
    }

    const bot = new Bot<BotContext>(token, {
      botInfo: JSON.parse(botInfo),
    });
    bot.init();
    bot.use(async (ctx, next) => {
      ctx.env = c.env;
      ctx.actor = "bot";

      const chatId = ctx.chat?.id ?? ctx.chatId;
      if (chatId === undefined || chatId === null) {
        await next();
        return;
      }

      // Resolve the account this chat is linked to (null if not yet linked).
      const repos = createRepositories(createDb(c.env.DB));
      const link = await repos.telegram.findLinkByChatId(chatId);
      ctx.accountId = link?.accountId ?? null;

      ctx.caller = createBotCaller(c.env, {
        accountId: ctx.accountId,
        telegram: {
          chatId,
          userId: ctx.from?.id,
          username: ctx.from?.username,
          firstName: ctx.from?.first_name,
          lastName: ctx.from?.last_name,
        },
      });

      const username = ctx.from?.username ?? "";
      const message = ctx.message?.text ?? "";
      log.bot.debug(`Message from @${username} #${chatId}`, message);

      await next();
    });

    registerHandlers(bot);
    await bot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    log.bot.error("Failed to process update");
    return c.json(
      {
        ok: false,
        error: "Failed to process update",
        logs: error,
      },
      500,
    );
  }
});

export default botRoutes;
