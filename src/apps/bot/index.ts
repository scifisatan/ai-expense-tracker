import { Bot } from "grammy";
import { Hono } from "hono";
import { createBotCaller } from "@api/caller";
import { createDb } from "@/db/client";
import { createRepositories } from "@api/repositories";
import { registerHandlers } from "@bot/handlers";
import { log } from "@/utils/logger";

import type { Update } from "grammy/types";
import type { BotContext } from "@bot/types";
import type { AppEnv, CloudflareBindings } from "@apps/env";

const botRoutes = new Hono<AppEnv>();

// Builds a grammY bot bound to this request's env. We rebuild per update rather
// than caching at module scope because the env-injection middleware closes over
// `env`, and overlapping `waitUntil` tasks would race on a shared instance. The
// cost is now off the critical path (see the `waitUntil` below), so it no longer
// delays the webhook ACK.
const buildBot = async (
  token: string,
  botInfo: string,
  env: CloudflareBindings,
): Promise<Bot<BotContext>> => {
  const bot = new Bot<BotContext>(token, { botInfo: JSON.parse(botInfo) });
  await bot.init();

  bot.use(async (ctx, next) => {
    ctx.env = env;
    ctx.actor = "bot";

    const chatId = ctx.chat?.id ?? ctx.chatId;
    if (chatId === undefined || chatId === null) {
      await next();
      return;
    }

    // Resolve the account this chat is linked to (null if not yet linked).
    const repos = createRepositories(createDb(env.DB));
    const link = await repos.telegram.findLinkByChatId(chatId);
    ctx.accountId = link?.accountId ?? null;

    ctx.caller = createBotCaller(env, {
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
  return bot;
};

// Best-effort dedup of Telegram retries. Telegram redelivers updates it didn't
// see a prompt 200 for; without this a slow handler can double-log money. KV is
// eventually consistent, so this is a soft guard against retry storms, not a hard
// exactly-once guarantee.
const alreadyHandled = async (kv: KVNamespace, updateId: number): Promise<boolean> => {
  const key = `tg-update:${updateId}`;
  if (await kv.get(key)) return true;
  await kv.put(key, "1", { expirationTtl: 3600 });
  return false;
};

botRoutes.post("/*", async (c) => {
  let update: Update;
  try {
    update = (await c.req.json()) as Update;
  } catch (error) {
    log.bot.error("Invalid update payload", error);
    return c.json({ ok: true });
  }

  const token = c.env.BOT_TOKEN;
  const botInfo = await c.env.BOT_INFO.get("BOT_INFO");

  if (!token || !botInfo) {
    log.bot.error("Missing BOT_TOKEN or BOT_INFO binding");
    return c.json({ ok: true });
  }

  // Dedup before processing; on a duplicate, ACK immediately.
  if (await alreadyHandled(c.env.BOT_INFO, update.update_id)) {
    return c.json({ ok: true });
  }

  const env = c.env;
  const processUpdate = async () => {
    try {
      const bot = await buildBot(token, botInfo, env);
      await bot.handleUpdate(update);
    } catch (error) {
      log.bot.error("Failed to process update", error);
    }
  };

  // ACK immediately; do the real work in the background so Telegram never retries
  // on a slow AI extraction. Always return 200 — failures are logged, not retried.
  c.executionCtx.waitUntil(processUpdate());
  return c.json({ ok: true });
});

export default botRoutes;
