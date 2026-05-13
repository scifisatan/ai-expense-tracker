import type { Bot } from "grammy"
import type { BotContext } from "@bot/types"
import { createBotController } from "../controller"
import { getChatKeyboard, formatMoney } from "../ui"

export const registerCallbackHandlers = (bot: Bot<BotContext>) => {
  const sendRecentTransactions = async (ctx: BotContext, chatId: number) => {
    const controller = createBotController(ctx.env)
    const transactions = await controller.listTransactions(chatId, 10)

    if (!transactions.length) {
      await ctx.api.sendMessage(chatId, "📭 No transactions recorded yet.", {
        reply_markup: getChatKeyboard()
      })
      return
    }

    const lines = transactions.map((tx, index) => {
      const sign = tx.type === "Expense" ? "-" : "+"
      const note = tx.note ? ` • ${tx.note}` : ""
      return `${index + 1}. ${sign}${formatMoney(tx.amount)}${note}`
    })

    await ctx.api.sendMessage(chatId, `📒 *Recent Transactions*\n\n${lines.join("\n")}`, {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard()
    })
  }

  const sendHelp = async (ctx: BotContext, chatId: number) => {
    await ctx.api.sendMessage(
      chatId,
      [
        "👋 *Budget Bot Help*",
        "",
        "• Send messages like `Paid 200`, `Got 500`, `Spent 120 and 80`",
        "• I extract transactions and update pinned balance automatically.",
        "• I also keep a per-chat transaction history in D1.",
        "",
        "*Commands*",
        "`/start` Initialize and pin balance",
        "`/app` Get your Chat ID and login OTP",
        "`/setkey <key>` Save your Groq API key",
        "`/removekey` Remove your saved Groq API key",
        "`/keystatus` Check if your key is set",
        "`/balance` Show current balance",
        "`/transactions` Show recent transactions",
        "`/clear` Wipe all your transaction data"
      ].join("\n"),
      {
        parse_mode: "Markdown",
        reply_markup: getChatKeyboard()
      }
    )
  }

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data
    const chatId = ctx.callbackQuery.message?.chat.id

    if (!data || !chatId) return

    const controller = createBotController(ctx.env)

    if (data === "ui:help") {
      await ctx.answerCallbackQuery()
      await sendHelp(ctx, chatId)
      return
    }

    if (data === "ui:balance") {
      await ctx.answerCallbackQuery()
      await controller.refreshBalance(chatId)
      return
    }

    if (data === "ui:transactions") {
      await ctx.answerCallbackQuery()
      await sendRecentTransactions(ctx, chatId)
      return
    }
  })
}
