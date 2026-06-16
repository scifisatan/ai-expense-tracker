import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"

type Props = {
  netMinor: number
  todayDeltaMinor: number
  incomeMinor: number
  expenseMinor: number
  currency: string
}

// The emotional centre of the app: where you stand, right now.
const BalanceHero = ({ netMinor, todayDeltaMinor, incomeMinor, expenseMinor, currency }: Props) => {
  const negative = netMinor < 0
  const deltaUp = todayDeltaMinor >= 0

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card p-7 shadow-sm sm:p-9">
      {/* warm ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative">
        <p className="text-sm font-medium text-muted-foreground">Current balance</p>

        <div className="mt-2 flex items-end gap-3">
          <span
            className={cn(
              "tabular text-5xl font-semibold tracking-tight sm:text-6xl",
              negative ? "text-expense" : "text-foreground"
            )}
          >
            {negative ? "−" : ""}
            {formatMoney(Math.abs(netMinor), currency)}
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
              <ArrowDownRight className="size-3.5" /> Income
            </div>
            <div className="tabular mt-1 text-lg font-semibold text-foreground">
              {formatMoney(incomeMinor, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-expense-muted/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-expense">
              <ArrowUpRight className="size-3.5" /> Spent
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
