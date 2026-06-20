import { Api } from "grammy"
import { eq } from "drizzle-orm"
import { telegramLinks } from "@/db/schema"
import { formatMoney } from "@/shared/money"
import { monthKey, monthRange } from "@/shared/datetime"
import type { ApiContext } from "@api/trpc"

// Thresholds (percent of budget) that trigger an alert, checked high-to-low so
// the most severe crossing is reported first.
const THRESHOLDS = [100, 80] as const

type AffectedItem = {
  type: "Income" | "Expense"
  categoryId: number | null
  amountMinor: number
}

type AlertCtx = Pick<ApiContext, "repos" | "db" | "env"> & { accountId: string }

const notifyLinkedChats = async (
  botToken: string | undefined,
  ctx: AlertCtx,
  text: string
): Promise<void> => {
  if (!botToken) return
  const links = await ctx.db.query.telegramLinks.findMany({
    where: eq(telegramLinks.accountId, ctx.accountId)
  })
  if (!links.length) return

  const api = new Api(botToken)
  for (const link of links) {
    try {
      await api.sendMessage(link.chatId, text)
    } catch (error) {
      console.error("[budget-alert-error]", error)
    }
  }
}

// After a write, check whether any budget crossed a threshold this period and, if
// so, push a one-time Telegram alert. Only expense items can move a budget, so
// no-op when none are present. Best-effort: failures are swallowed so they never
// break the originating transaction.
export const checkBudgetAlerts = async (ctx: AlertCtx, items: AffectedItem[]): Promise<void> => {
  try {
    const expenses = items.filter((i) => i.type === "Expense")
    if (!expenses.length) return

    const budgets = await ctx.repos.budgets.listByAccount(ctx.accountId)
    if (!budgets.length) return

    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const currency = account?.defaultCurrency ?? "USD"
    const range = monthRange(timezone)
    const periodKey = monthKey(timezone)

    const affectedCategoryIds = new Set(expenses.map((i) => i.categoryId))
    const categories = await ctx.repos.categories.listByAccount(ctx.accountId)
    const categoryName = (id: number | null) =>
      id === null ? "overall" : (categories.find((c) => c.id === id)?.name ?? "category")

    for (const budget of budgets) {
      // Overall budgets are always affected by any expense; category budgets only
      // when an item touched that category.
      if (budget.categoryId !== null && !affectedCategoryIds.has(budget.categoryId)) continue
      if (budget.amountMinor <= 0) continue

      const spend = await ctx.repos.transactions.getCategoryExpenseInRange(
        ctx.accountId,
        budget.categoryId,
        range.from,
        range.to
      )
      const pct = (spend / budget.amountMinor) * 100

      for (const threshold of THRESHOLDS) {
        if (pct < threshold) continue
        if (await ctx.repos.budgets.hasAlerted(budget.id, periodKey, threshold)) break
        await ctx.repos.budgets.recordAlert(budget.id, periodKey, threshold)

        const label = categoryName(budget.categoryId)
        const text =
          threshold >= 100
            ? `🚨 Budget exceeded — ${label}\nSpent ${formatMoney(spend, currency)} of ${formatMoney(budget.amountMinor, currency)} this month.`
            : `⚠️ 80% of your ${label} budget used\nSpent ${formatMoney(spend, currency)} of ${formatMoney(budget.amountMinor, currency)} this month.`
        await notifyLinkedChats(ctx.env.BOT_TOKEN, ctx, text)
        break // one alert per budget per write
      }
    }
  } catch (error) {
    console.error("[budget-alert-check-error]", error)
  }
}
