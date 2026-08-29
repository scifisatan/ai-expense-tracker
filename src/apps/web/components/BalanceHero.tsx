import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"

type Props = {
  // All-time net — the same figure as the pinned Telegram balance.
  balanceMinor: number
  todayDeltaMinor: number
  // Month-to-date figures for the tiles below.
  incomeMinor: number
  expenseMinor: number
  currency: string
}

// The emotional centre of the app: where you stand, right now.
const BalanceHero = ({ balanceMinor, todayDeltaMinor, incomeMinor, expenseMinor, currency }: Props) => {
  const negative = balanceMinor < 0
  const deltaUp = todayDeltaMinor >= 0

  return (
    <section className="overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Current balance</p>

        <div className="mt-2 flex items-end gap-3">
          <span
            className={cn(
              "tabular text-5xl font-semibold tracking-tight sm:text-6xl",
              negative ? "text-expense" : "text-foreground"
            )}
          >
            {negative ? "−" : ""}
            {formatMoney(Math.abs(balanceMinor), currency)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium",
              deltaUp ? "bg-income-muted text-income" : "bg-expense-muted text-expense"
            )}
          >
            {deltaUp ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            <span className="tabular">
              {deltaUp ? "+" : "−"}
              {formatMoney(Math.abs(todayDeltaMinor), currency)}
            </span>
            <span className="text-muted-foreground">today</span>
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-income-muted/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-income">
              <ArrowDownRight className="size-3.5" /> Income this month
            </div>
            <div className="tabular mt-1 text-lg font-semibold text-foreground">
              {formatMoney(incomeMinor, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-expense-muted/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-expense">
              <ArrowUpRight className="size-3.5" /> Spent this month
            </div>
            <div className="tabular mt-1 text-lg font-semibold text-foreground">
              {formatMoney(expenseMinor, currency)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BalanceHero
