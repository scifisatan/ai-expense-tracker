import { Bot } from "grammy"
import { Hono } from "hono"
import { BotContext } from "@bot/types"
import { registerHandlers } from "@bot/handlers"
import { log } from "@/utils/logger"

import type { Update } from "grammy/types"
import type { AppEnv } from "@apps/env"

const botRoutes = new Hono<AppEnv>()

botRoutes.post("/", async (c) => {
  try {
    const update = (await c.req.json()) as Update

    const token = c.env.BOT_TOKEN
    const botInfo = await c.env.BOT_INFO.get("BOT_INFO")

    if (!token) {
      const errorMsg: string = "Missing BOT_TOKEN binding"
      log.bot.error(errorMsg)
      throw new Error(errorMsg)
    }

    if (!botInfo) {
      const errorMsg: string = "Missing BOT_INFO binding"
      log.bot.error(errorMsg, botInfo)
      throw new Error(errorMsg)
    }

    const bot = new Bot<BotContext>(token, {
      botInfo: JSON.parse(botInfo)
    })

    bot.use(async (ctx, next) => {
      ctx.env = c.env

      const chatId = ctx.chatId
      const username = ctx.from?.username ?? ""
      const message = ctx.message?.text ?? ""
      log.bot.debug(`Message from @${username} #${chatId}`, message)

      await next()
    })

    registerHandlers(bot)
    await bot.handleUpdate(update)

    return c.json({ ok: true })
  } catch (error) {
    log.bot.error("Failed to process update")
    return c.json(
      {
        ok: false,
        error: "Failed to process update",
        logs: error
      },
      500
    )
  }
})

export default botRoutes
