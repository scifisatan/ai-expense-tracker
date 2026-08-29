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
  today: "🎯 Today",
  help: "ℹ️ Help",
} as const

export const BUTTON_BALANCE_RE = /^💰\s*Balance$/i
export const BUTTON_TRANSACTIONS_RE = /^📒\s*Transactions$/i
export const BUTTON_TODAY_RE = /^🎯\s*Today$/i
export const BUTTON_HELP_RE = /^ℹ️\s*Help$/i

// True when free text is really a tap on one of the persistent keyboard buttons.
export const isKeyboardButton = (text: string): boolean =>
  BUTTON_BALANCE_RE.test(text) ||
  BUTTON_TRANSACTIONS_RE.test(text) ||
  BUTTON_TODAY_RE.test(text) ||
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

// Undo button attached to a freshly-recorded message. Callback data carries the
// inserted transaction ids. Telegram caps callback_data at 64 bytes, so for large
// batches we fall back to undoing only the most recent id.
export const getUndoKeyboard = (ids: number[]): InlineKeyboard | undefined => {
  if (!ids.length) return undefined
  let data = `ui:undo:${ids.join(",")}`
  if (data.length > 64) data = `ui:undo:${ids[ids.length - 1]}`
  return new InlineKeyboard().text("↩️ Undo", data)
}

// Persistent reply keyboard pinned to the chat composer.
export const getChatKeyboard = () => ({
  keyboard: [
    [{ text: BUTTON.balance }, { text: BUTTON.transactions }],
    [{ text: BUTTON.today }, { text: BUTTON.help }],
    [{ text: "/start" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
})

type LedgerItem = {
  amountMinor: number
  type: "Income" | "Expense"
  note?: string | null
  categoryName?: string | null
  occurredAt?: string
}

// "Jul 3" from a DB timestamp ("YYYY-MM-DD HH:MM:SS") or bare date. Falls back
// to the raw date part if parsing fails.
const shortDate = (dbTimestamp: string): string => {
  const datePart = dbTimestamp.slice(0, 10)
  const parsed = new Date(`${datePart}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return datePart
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
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
      // Show what the AI decided (note, category, backdate) so mistakes are
      // catchable at a glance — Undo is right there.
      const parts = [
        item.note ? escapeMd(item.note) : null,
        item.categoryName ? escapeMd(item.categoryName) : null,
        item.occurredAt ? shortDate(item.occurredAt) : null,
      ].filter(Boolean)
      const detail = parts.length ? ` · ${parts.join(" · ")}` : ""
      return `• ${signedAmount(item, currency)}${detail}`
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

  // Shown after a recorded message is undone via the inline button.
  undone: (): string => "↩️ Undone — those entries were removed and your balance is back to where it was.",

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

  // This-month summary (income / expense / net).
  monthSummary: (
    summary: { income: number; expense: number; net: number; transactions: number },
    currency: string,
  ): string => {
    const netSign = summary.net >= 0 ? "+" : "-"
    return [
      "📅 This month so far:",
      "",
      `Income: +${formatMoney(summary.income, currency)}`,
      `Spending: -${formatMoney(summary.expense, currency)}`,
      `Net: ${netSign}${formatMoney(Math.abs(summary.net), currency)}`,
      `Across ${summary.transactions} ${summary.transactions === 1 ? "entry" : "entries"}.`,
    ].join("\n")
  },

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
      "`/month` — This month's income, spending & net",
      "`/today` — Today's pacing number",
      "`/want 8500 headphones` — Queue a want",
      "`/need 3000 shoes` — Queue a need",
      "`/queue` — See what's queued",
      "`/undo` — Remove your most recent entry",
    ].join("\n"),

  // /today when a pacing cycle is running.
  today: (snapshot: {
    currency: string
    allowanceMinor: number
    remainingTodayMinor: number
    daysRemainingInclusive: number
    wantFundMinor: number
    needsReserveMinor: number
    nearestQueueItem: { title: string; daysToAfford: number | null } | null
  }): string => {
    const overspent = snapshot.remainingTodayMinor < 0
    const lines = [
      `🎯 Today's number: *${formatMoney(snapshot.allowanceMinor, snapshot.currency)}*`,
      overspent
        ? `${formatMoney(Math.abs(snapshot.remainingTodayMinor), snapshot.currency)} over today's allowance`
        : `${formatMoney(snapshot.remainingTodayMinor, snapshot.currency)} left today`,
      "",
      `Want Fund: ${formatMoney(snapshot.wantFundMinor, snapshot.currency)}`,
      `Needs reserve: ${formatMoney(snapshot.needsReserveMinor, snapshot.currency)}`,
      `${snapshot.daysRemainingInclusive} day${snapshot.daysRemainingInclusive === 1 ? "" : "s"} left in this cycle`,
    ]
    if (snapshot.nearestQueueItem) {
      const { title, daysToAfford } = snapshot.nearestQueueItem
      const projection =
        daysToAfford === null
          ? "not affordable at the current pace yet"
          : daysToAfford === 0
            ? "affordable now"
            : `about ${daysToAfford} day${daysToAfford === 1 ? "" : "s"} away`
      lines.push("", `Next up: ${escapeMd(title)} — ${projection}`)
    }
    return lines.join("\n")
  },

  // /today with no pacing cycle running.
  noCycle: (): string =>
    [
      "🌱 No pacing cycle running yet.",
      "",
      "Start one from your dashboard — set your income and what's already spoken for, and I'll tell you your number every day.",
    ].join("\n"),

  // Response to /want or /need on success.
  queueAdded: (item: {
    title: string
    priceMinor: number
    currency: string
    coolingUntil: string | null
  }): string =>
    [
      `✅ Added to your queue: *${escapeMd(item.title)}* — ${formatMoney(item.priceMinor, item.currency)}`,
      item.coolingUntil ? `Cooling off until ${item.coolingUntil}.` : "",
    ]
      .filter(Boolean)
      .join("\n"),

  // Shown when /want or /need is missing its price/title.
  queueUsage: (kind: "want" | "need"): string =>
    `Try it like this: \`/${kind} ${kind === "want" ? "8500 headphones" : "3000 shoes"}\``,

  // /queue — top items from each track.
  queueList: (
    wants: { title: string; priceMinor: number; currency: string; daysToAfford: number | null }[],
    needs: { title: string; priceMinor: number; currency: string }[]
  ): string => {
    if (!wants.length && !needs.length) {
      return [
        "📭 Nothing queued yet.",
        "",
        "Try `/want 8500 headphones` or `/need 3000 shoes`.",
      ].join("\n")
    }

    const lines = ["📋 Your queue:"]
    if (wants.length) {
      lines.push("", "*Wants*")
      wants.slice(0, 5).forEach((item, index) => {
        const projection =
          item.daysToAfford === null
            ? "not affordable yet"
            : item.daysToAfford === 0
              ? "affordable now"
              : `~${item.daysToAfford}d away`
        lines.push(`${index + 1}. ${escapeMd(item.title)} — ${formatMoney(item.priceMinor, item.currency)} (${projection})`)
      })
    }
    if (needs.length) {
      lines.push("", "*Needs*")
      needs.slice(0, 5).forEach((item, index) => {
        lines.push(`${index + 1}. ${escapeMd(item.title)} — ${formatMoney(item.priceMinor, item.currency)}`)
      })
    }
    return lines.join("\n")
  },

  // Shown when free text parsed fine but contained no recognizable amounts.
  nothingFound: (): string =>
    [
      "🤔 I couldn't find an amount in that.",
      "",
      "Try including a number — like `Spent 12.50 on coffee` or `Got 500 salary` — and I'll log it right away.",
    ].join("\n"),

  // Shown when the account hits its daily AI extraction limit.
  rateLimited: (): string =>
    "🚦 You've hit today's limit for reading messages. It resets tomorrow — or add entries manually in the dashboard any time.",

  // Generic fallbacks.
  startError: (): string =>
    "😕 Something hiccuped while getting set up. Mind trying /start once more?",

  genericError: (): string =>
    "😕 I couldn't process that one. Mind giving it another go?",
}
