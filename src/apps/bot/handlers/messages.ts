import type { Bot } from "grammy"
import type { BotContext } from "@bot/types"
import { createBotController } from "../controller"
import { getMissingKeyWarning, formatMoney } from "../ui"
import { log } from "@/utils/logger"

export const registerMessageHandlers = (bot: Bot<BotContext>) => {
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id
    const userId = ctx.from?.id
    if (!userId) return

    const text = ctx.message.text.trim()

    if (!text || text.startsWith("/")) return
    if (
      /^💰\s*Balance$/i.test(text) ||
      /^📒\s*Transactions$/i.test(text) ||
      /^ℹ️\s*Help$/i.test(text)
    )
      return

    try {
      const controller = createBotController(ctx.env)

      const key = await controller.getGroqKey(userId)
      if (!key) {
        await ctx.reply(getMissingKeyWarning(), { parse_mode: "Markdown" })
        return
      }

      const processingMsg = await ctx.reply("⏳ _Processing your message..._", {
        parse_mode: "Markdown"
      })

      await ctx.api.sendChatAction(chatId, "typing")
      const result = await controller.processMessage(chatId, userId, text)

      if (!result) {
        await ctx.api.deleteMessage(chatId, processingMsg.message_id).catch(() => {})
        return
      }

      await ctx.api.editMessageText(
        chatId,
        processingMsg.message_id,
        [
          `✅ Recorded ${result.items.length} transaction(s)`,
          ...result.items.map(
            (item) =>
              `• ${item.type === "Expense" ? "-" : "+"}${formatMoney(item.amount)}${item.note ? ` (${item.note})` : ""}`
          ),
          `\nNet change: ${result.net >= 0 ? "+" : ""}${formatMoney(result.net)}`,
          `New balance: ${formatMoney(result.newBalance)}`
        ].join("\n")
      )
    } catch (err: any) {
      log.bot.error("[extract-error]", err)
      await ctx.reply("Failed to process message. Check your Groq API key and try again.")
    }
  })
}
