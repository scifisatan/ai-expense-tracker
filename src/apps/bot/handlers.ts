import { InlineKeyboard } from "grammy"
import type { Bot } from "grammy"
import { log } from "../../utils/logger"
import type { BotContext } from "@bot/types"
import { createAppContext } from "../../shared/service/create-app-context"
import { createTelegramBalancePublisher } from "@/shared/service/telegram-bot-service"

const getMainMenu = () =>
  new InlineKeyboard()
    .text("💰 Show Balance", "ui:balance")
    .text("📒 Transactions", "ui:transactions")
    .row()
    .text("ℹ️ Help", "ui:help")

const getChatKeyboard = () => ({
  keyboard: [
    [{ text: "💰 Balance" }, { text: "📒 Transactions" }],
    [{ text: "ℹ️ Help" }],
    [{ text: "/start" }]
  ],
  resize_keyboard: true,
  is_persistent: true
})

const formatMoney = (value: number) => `Rs. ${value}`

const getMissingKeyWarning = () =>
  [
    "⚠️ Your Groq API key is not set.",
    "Please set it first:",
    "`/setkey <your_groq_api_key>`",
    "",
    "Example:",
    "`/setkey gsk_xxxxx`"
  ].join("\n")

export const registerHandlers = (bot: Bot<BotContext>) => {
  const getServices = (ctx: BotContext) => {
    const botToken = ctx.env.BOT_TOKEN
    const appContext = createAppContext({
      db: ctx.env.DB,
      env: ctx.env,
      telegram: {
        balancePublisher: createTelegramBalancePublisher(botToken),
        botToken
      }
    })

    return {
      telegramBot: appContext.telegramBot
    }
  }

  const requireUserGroqKey = async (ctx: BotContext, userId: number) => {
    const { telegramBot } = getServices(ctx)
    const key = await telegramBot.getGroqApiKey(userId)

    if (!key) {
      await ctx.reply(getMissingKeyWarning(), { parse_mode: "Markdown" })
      return null
    }

    return key
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

  const sendBalance = async (ctx: BotContext) => {
    if (!ctx.chat) return
    const { telegramBot } = getServices(ctx)
    await telegramBot.refreshPinnedBalance(ctx.chat.id)
  }

  const sendRecentTransactions = async (ctx: BotContext, chatId: number) => {
    const { telegramBot } = getServices(ctx)
    const transactions = await telegramBot.listRecentTransactions(chatId, 10)

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
      const { telegramBot } = getServices(ctx)

      await telegramBot.registerUser({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      })

      const currentBalance = await telegramBot.refreshPinnedBalance(chatId)
      const existingKey = await telegramBot.getGroqApiKey(user.id)

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

    const { telegramBot } = getServices(ctx)
    await telegramBot.setGroqApiKey(userId, apiKey)
    await ctx.reply("✅ Your Groq API key has been saved.")
  })

  bot.command("removekey", async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const { telegramBot } = getServices(ctx)
    await telegramBot.removeGroqApiKey(userId)
    await ctx.reply("🗑️ Your Groq API key has been removed.")
  })

  bot.command("keystatus", async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    const { telegramBot } = getServices(ctx)
    const key = await telegramBot.getGroqApiKey(userId)
    await ctx.reply(key ? "✅ Groq API key is set." : "❌ Groq API key is not set.")
  })

  bot.command("clear", async (ctx) => {
    const chatId = ctx.chat.id
    const lastMessageId = ctx.message?.message_id

    if (!lastMessageId) return

    const feedback = await ctx.reply("🧹 *Cleaning up chat (deep sweep)...*", {
      parse_mode: "Markdown"
    })

    // Deep sweep: Check the last 500 potential message IDs.
    // In low-traffic bots, message IDs can have large gaps.
    const range = 500
    const messageIds = Array.from({ length: range }, (_, i) => lastMessageId - i)

    const batchSize = 100
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const chunk = messageIds.slice(i, i + batchSize)
      // Run each batch in parallel
      await Promise.all(chunk.map((id) => ctx.api.deleteMessage(chatId, id).catch(() => {})))
    }

    // Also try to delete the "cleaning up" message
    await ctx.api.deleteMessage(chatId, feedback.message_id).catch(() => {})

    await ctx.reply("✨ *Chat cleaned.*", {
      parse_mode: "Markdown",
      reply_markup: getChatKeyboard()
    })
  })

  bot.command("help", async (ctx) => sendHelp(ctx, ctx.chat.id))
  bot.command("menu", async (ctx) => {
    await ctx.reply("Quick actions:", { reply_markup: getMainMenu() })
    await ctx.reply("Keyboard enabled ⌨️", { reply_markup: getChatKeyboard() })
  })
  bot.command("balance", async (ctx) => sendBalance(ctx))
  bot.command("transactions", async (ctx) => sendRecentTransactions(ctx, ctx.chat.id))

  bot.hears(/^💰\s*Balance$/i, async (ctx) => sendBalance(ctx))
  bot.hears(/^📒\s*Transactions$/i, async (ctx) => sendRecentTransactions(ctx, ctx.chat.id))
  bot.hears(/^ℹ️\s*Help$/i, async (ctx) => sendHelp(ctx, ctx.chat.id))

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data
    const chatId = ctx.callbackQuery.message?.chat.id

    if (!data || !chatId) return

    if (data === "ui:help") {
      await ctx.answerCallbackQuery()
      await sendHelp(ctx, chatId)
      return
    }

    if (data === "ui:balance") {
      await ctx.answerCallbackQuery()
      await sendBalance(ctx)
      return
    }

    if (data === "ui:transactions") {
      await ctx.answerCallbackQuery()
      await sendRecentTransactions(ctx, chatId)
      return
    }
  })

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
      const { telegramBot } = getServices(ctx)

      const userGroqToken = await requireUserGroqKey(ctx, userId)
      if (!userGroqToken) return

      const processingMsg = await ctx.reply("⏳ _Processing your message..._", {
        parse_mode: "Markdown"
      })

      await ctx.api.sendChatAction(chatId, "typing")
      const result = await telegramBot.processUserMessage(chatId, userId, text, userGroqToken)

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

      // Reply keyboard cannot be attached via editMessageText, so we send a separate message
      // or just rely on the existing persistent keyboard.
      // Since the user just sent a message, the keyboard is likely already visible.
    } catch (err: any) {
      log.error("[extract-error]", err)
      await ctx.reply("Failed to process message. Check your Groq API key and try again.")
    }
  })
}
