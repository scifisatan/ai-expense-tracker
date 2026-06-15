import { InlineKeyboard } from "grammy"
import { formatMoney } from "@/shared/money"

export { formatMoney }

// ---------------------------------------------------------------------------
// Shared bot voice: warm & friendly companion. Light personality, tasteful
// emoji (≤1–2 per message), sentence case, never robotic. ALL user-facing copy
// and keyboards live in this file so the two surfaces feel like one product.
// ---------------------------------------------------------------------------

// Persistent-keyboard button labels. The handlers route on these exact strings,
// so the regex matchers (BUTTON_BALANCE_RE etc.) must stay in sync with them.
export const BUTTON = {
  balance: "💰 Balance",
  transactions: "📒 Transactions",
  help: "ℹ️ Help",
} as const

export const BUTTON_BALANCE_RE = /^💰\s*Balance$/i
export const BUTTON_TRANSACTIONS_RE = /^📒\s*Transactions$/i
export const BUTTON_HELP_RE = /^ℹ️\s*Help$/i

// True when free text is really a tap on one of the persistent keyboard buttons.
export const isKeyboardButton = (text: string): boolean =>
  BUTTON_BALANCE_RE.test(text) ||
  BUTTON_TRANSACTIONS_RE.test(text) ||
  BUTTON_HELP_RE.test(text)

// Escape characters that would break legacy "Markdown" parsing when we
// interpolate untrusted values (notes, usernames, codes). We keep parse_mode
// "Markdown" everywhere, so escaping _ * ` [ is enough to stay safe.
const escapeMd = (value: string): string =>
  value.replace(/([_*`[])/g, "\\$1")

// Inline-keyboard shown under rich messages.
export const getMainMenu = () =>
  new InlineKeyboard()
    .text("💰 Show balance", "ui:balance")
    .text("📒 Transactions", "ui:transactions")
    .row()
    .text("ℹ️ Help", "ui:help")

// Persistent reply keyboard pinned to the chat composer.
export const getChatKeyboard = () => ({
  keyboard: [
    [{ text: BUTTON.balance }, { text: BUTTON.transactions }],
    [{ text: BUTTON.help }],
    [{ text: "/start" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
})

type LedgerItem = {
  amountMinor: number
  type: "Income" | "Expense"
  note?: string | null
}

type RecentTransaction = {
  amountMinor: number
  currency: string
  type: "Income" | "Expense"
  note?: string | null
}

// Signed, human-readable amount for a single line, e.g. "+$500.00" / "-$12.50".
const signedAmount = (item: { amountMinor: number; type: "Income" | "Expense" }, currency: string): string => {
  const sign = item.type === "Expense" ? "-" : "+"
  return `${sign}${formatMoney(item.amountMinor, currency)}`
}

// ---------------------------------------------------------------------------
// Message builders. Handlers call these instead of holding inline strings.
// ---------------------------------------------------------------------------

export const msg = {
  // Shown whenever the chat isn't linked to an account yet.
  notLinked: (appUrl: string | null): string =>
    [
      "👋 Let's get you connected!",
      "",
      "Just a couple of quick steps and I'll start tracking your money:",
      "",
      `1. Open your dashboard${appUrl ? ` and sign in with Google:\n   ${appUrl}/app` : " and sign in with Google."}`,
      "2. Send `/link` here and I'll give you a connection code",
      "3. Pop that code into *Settings → Connect Telegram* in the dashboard",
      "",
      "Once we're linked, just tell me about your spending and I'll keep your balance up to date. 💪",
    ].join("\n"),

  // Response to /link — hands over a one-time connection code.
  linkCode: (code: string, expiresInSeconds: number, appUrl: string | null): string =>
    [
      "🔗 Here's your connection code:",
      "",
      `\`${escapeMd(code)}\``,
      "",
      "To finish linking this chat:",
      `1. Sign in to your dashboard with Google${appUrl ? `:\n   ${appUrl}/app` : "."}`,
      "2. Open *Settings → Connect Telegram*",
      `3. Enter the code above — it's good for ${Math.round(expiresInSeconds / 60)} minutes`,
      "",
      "See you on the other side! 😊",
    ].join("\n"),

  // Response to /start once linked.
  started: (): string =>
    [
      "🎉 You're all set — budget tracking is live!",
      "",
      "I've pinned your current balance up top so it's always one glance away.",
      "",
      "Whenever you spend or earn, just tell me in plain language — try `Spent 12.50 on coffee` or `Got 500 salary` — and I'll take care of the rest.",
    ].join("\n"),

  // Web dashboard link (/app).
  appLink: (appUrl: string | null): string =>
    [
      "📱 Your dashboard lives here:",
      "",
      appUrl ? `[Open dashboard](${appUrl}/app)` : "Open your deployed dashboard in a browser.",
      "",
      "Sign in with Google, then send `/link` here to connect this chat. 😊",
    ].join("\n"),

  // Capture confirmation after free-text ingestion.
  recorded: (
    items: LedgerItem[],
    net: number,
    newBalance: number,
    currency: string,
  ): string => {
    const count = items.length
    const lines = items.map((item) => {
      const note = item.note ? ` · ${escapeMd(item.note)}` : ""
      return `• ${signedAmount(item, currency)}${note}`
    })
    const netSign = net >= 0 ? "+" : "-"
    return [
      `✅ Got it — logged ${count} ${count === 1 ? "transaction" : "transactions"}:`,
      "",
      ...lines,
      "",
      `Net change: ${netSign}${formatMoney(Math.abs(net), currency)}`,
      `New balance: *${formatMoney(newBalance, currency)}*`,
    ].join("\n")
  },

  // In-chat balance line (rich, Markdown). The pinned balance in
  // src/apps/api/lib/ledger.ts is sent as plain text and formatted there.
  balance: (balanceMinor: number, currency: string): string =>
    `💰 Current balance: *${formatMoney(balanceMinor, currency)}*`,

  // Recent-transactions list.
  recentTransactions: (items: RecentTransaction[]): string => {
    const lines = items.map((tx, index) => {
      const note = tx.note ? ` · ${escapeMd(tx.note)}` : ""
      return `${index + 1}. ${signedAmount(tx, tx.currency)}${note}`
    })
    return ["📒 Your recent activity:", "", ...lines].join("\n")
  },

  noTransactions: (): string =>
    "📭 Nothing here yet! Tell me about a purchase — like `Spent 8 on lunch` — and it'll show up here.",

  // /help.
  help: (): string =>
    [
      "👋 Here's how I can help!",
      "",
      "Just talk to me naturally — send things like `Paid 200`, `Got 500`, or `Spent 12.50 on coffee` and I'll log them and refresh your pinned balance automatically.",
      "",
      "*Handy commands*",
      "`/start` — Check status or get connected",
      "`/link` — Get a code to connect this chat",
      "`/app` — Open your web dashboard",
      "`/balance` — Show your current balance",
      "`/transactions` — See recent activity",
      "`/setkey <key>` — Save your Groq API key",
      "`/removekey` — Remove your saved key",
      "`/keystatus` — Check if your key is set",
    ].join("\n"),

  // Groq key onboarding / status copy.
  missingKey: (): string =>
    [
      "🔑 Almost there — I just need a Groq API key to read your messages.",
      "",
      "Add it in the dashboard settings, or right here with:",
      "`/setkey <your_groq_api_key>`",
      "",
      "For example:",
      "`/setkey gsk_xxxxx`",
    ].join("\n"),

  setKeyUsage: (): string =>
    "To save your key, send it like this:\n`/setkey <your_groq_api_key>`",

  keySaved: (): string =>
    "✅ Your Groq API key is saved — you're ready to roll!",

  keyRemoved: (): string =>
    "🗑️ Done — your Groq API key has been removed.",

  keyStatus: (hasKey: boolean): string =>
    hasKey
      ? "✅ Your Groq API key is set — all good!"
      : "🔑 No Groq API key yet. Add one with `/setkey <your_groq_api_key>` whenever you're ready.",

  // Generic fallbacks.
  startError: (): string =>
    "😕 Something hiccuped while getting set up. Mind trying /start once more?",

  genericError: (): string =>
    "😕 I couldn't process that one. Double-check your Groq API key and give it another go.",
}
