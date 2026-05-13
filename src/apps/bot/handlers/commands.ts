import type { Bot } from "grammy"
import type { BotContext } from "@bot/types"
import { createBotController } from "../controller"
import { getChatKeyboard, getMissingKeyWarning, formatMoney } from "../ui"

export const registerCommandHandlers = (bot: Bot<BotContext>) => {
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

  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id
    const user = ctx.from
    if (!user) return

    try {
      const controller = createBotController(ctx.env)

      await controller.registerUser({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      })

      const currentBalance = await controller.refreshBalance(chatId)
      const existingKey = await controller.getGroqKey(user.id)

      await ctx.reply(
        `✅ Budget tracking is active. I pinned the current balance at Rs. ${currentBalance}.\n\n🌐 Web app: open the deployed domain, enter chat ID \`${chatId}\`, and use /app to get your OTP.`,
        {
          parse_mode: "Markdown",
          reply_markup: getChatKeyboard()
        }
      )

      if (!existingKey) {
        await ctx.reply(getMissingKeyWarning(), { parse_mode: "Markdown" })
      } else {
        await ctx.reply("🔐 Groq API key is already set for your account.")
      }
    } catch (e) {
      console.error("[start-balance-error]", e)
      await ctx.reply("Failed to initialize. Please try /start again.")
    }
  })

  bot.command("app", async (ctx) => {
    const chatId = ctx.chat.id
    const username = ctx.from?.username
    const webappUrl = ctx.env.WEBHOOK_URL ? ctx.env.WEBHOOK_URL.replace(/\/$/, "") : null

    let message = `📱 *Web App Access*\n\n`

    if (username) {
      message += `Your Username: \`@${username}\`\n`
    } else {
      message += `Your Chat ID: \`${chatId}\`\n`
    }

    message += "\n"

    if (webappUrl) {
      message += `🔗 [Open Dashboard](${webappUrl}/app)\n\n`
    }

    message += `1️⃣ Open the dashboard\n2️⃣ Enter your ${username ? "Username" : "Chat ID"}\n3️⃣ Click "Request OTP"\n4️⃣ I will send you a login code here!`

    await ctx.reply(message, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true }
    })
  })

  bot.command("setkey", async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const apiKey = ctx.match?.trim()

    if (!apiKey) {
      await ctx.reply("Usage: /setkey <your_groq_api_key>")
      return
    }

    const controller = createBotController(ctx.env)
    await controller.setGroqKey(userId, apiKey)
    await ctx.reply("✅ Your Groq API key has been saved.")
  })

  bot.command("removekey", async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const controller = createBotController(ctx.env)
    await controller.removeGroqKey(userId)
    await ctx.reply("🗑️ Your Groq API key has been removed.")
  })

  bot.command("keystatus", async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const controller = createBotController(ctx.env)
    const key = await controller.getGroqKey(userId)
    await ctx.reply(key ? "✅ Groq API key is set." : "❌ Groq API key is not set.")
  })

  bot.command("help", async (ctx) => sendHelp(ctx, ctx.chat.id))
  
  bot.command("balance", async (ctx) => {
    const controller = createBotController(ctx.env)
    await controller.refreshBalance(ctx.chat.id)
  })

  bot.command("transactions", async (ctx) => sendRecentTransactions(ctx, ctx.chat.id))

  bot.hears(/^💰\s*Balance$/i, async (ctx) => {
    const controller = createBotController(ctx.env)
    await controller.refreshBalance(ctx.chat.id)
  })
  
  bot.hears(/^📒\s*Transactions$/i, async (ctx) => sendRecentTransactions(ctx, ctx.chat.id))
  bot.hears(/^ℹ️\s*Help$/i, async (ctx) => sendHelp(ctx, ctx.chat.id))
}
