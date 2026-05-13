import { InlineKeyboard } from "grammy"

export const getMainMenu = () =>
  new InlineKeyboard()
    .text("💰 Show Balance", "ui:balance")
    .text("📒 Transactions", "ui:transactions")
    .row()
    .text("ℹ️ Help", "ui:help")

export const getChatKeyboard = () => ({
  keyboard: [
    [{ text: "💰 Balance" }, { text: "📒 Transactions" }],
    [{ text: "ℹ️ Help" }],
    [{ text: "/start" }]
  ],
  resize_keyboard: true,
  is_persistent: true
})

export const formatMoney = (value: number) => `Rs. ${value}`

export const getMissingKeyWarning = () =>
  [
    "⚠️ Your Groq API key is not set.",
    "Please set it first:",
    "`/setkey <your_groq_api_key>`",
    "",
    "Example:",
    "`/setkey gsk_xxxxx`"
  ].join("\n")
