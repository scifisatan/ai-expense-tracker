import type { Bot } from "grammy"
import type { BotContext } from "@bot/types"
import { isKeyboardButton, msg } from "../ui"
import { log } from "@/utils/logger"

export const registerMessageHandlers = (bot: Bot<BotContext>) => {
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id
    const text = ctx.message.text.trim()

    if (!text || text.startsWith("/")) return
    if (isKeyboardButton(text)) return

    if (!ctx.accountId) {
      const appUrl = ctx.env.APP_URL?.replace(/\/$/, "") ?? ctx.env.WEBHOOK_URL?.replace(/\/$/, "") ?? null
      await ctx.reply(msg.notLinked(appUrl), {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      })
      return
    }

    try {
      const processingMsg = await ctx.reply("⏳ _One sec, reading your message..._", {
        parse_mode: "Markdown",
      })

      await ctx.api.sendChatAction(chatId, "typing")
      const result = await ctx.caller.ledger.ingestText({ text })

      if (result.reason === "NO_KEY") {
        await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})
        await ctx.reply(msg.missingKey(), { parse_mode: "Markdown" })
        return
      }

      if (!result.items.length || result.newBalance === null) {
        await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})
        return
      }

      await ctx.api.editMessageText(
        chatId,
        processingMsg.message_id,
        msg.recorded(result.items, result.net, result.newBalance, result.currency),
        { parse_mode: "Markdown" },
      )
    } catch (error) {
      log.bot.error("[extract-error]", error)
      await ctx.reply(msg.genericError())
    }
  })
}
