import { Bot } from "grammy";
import { Hono } from "hono";
import { BotContext } from "@bot/types";
import { registerHandlers } from "@bot/handlers";

import type { Update } from "grammy/types";
import type { AppContext, AppEnv } from "@apps/env";

const botRoutes = new Hono<AppEnv>();

const handleUpdate = async (c: AppContext) => {
  try {
    const update = (await c.req.json()) as Update;

    const updateType = Object.keys(update).find(
      (key) => key !== "update_id",
    );

    console.info("[webhook-received]", {
      updateId: update.update_id,
      type: updateType,
    });

      const token = c.env.BOT_TOKEN;
      if (!token) {
        throw new Error("Missing BOT_TOKEN binding");
      }

    const bot = new Bot<BotContext>(token);

      registerHandlers(bot);

    await bot.init();
    await bot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    console.error("[webhook-error]", error);

    return c.json(
      {
        ok: false,
        error: "Failed to process update",
      },
      500,
    );
  }
};

botRoutes.post("/webhook", async (c) => {
  return handleUpdate(c);
});

botRoutes.post("/bot*", async (c) => {
  const effectiveToken = c.env.BOT_TOKEN;

  const path = c.req.path;
  const pathToken = path.slice("/bot".length);

  if (!effectiveToken || pathToken !== effectiveToken) {
    console.warn("[webhook-rejected]", {
      reason: "token_mismatch",
      hasEffectiveToken: Boolean(effectiveToken),
      path: c.req.path,
    });

    return c.json(
      {
        ok: false,
        error: "Invalid bot token received",
      },
      403,
    );
  }

  return handleUpdate(c);
});

botRoutes.get("/", (c) => c.redirect("/app"));

export default botRoutes;