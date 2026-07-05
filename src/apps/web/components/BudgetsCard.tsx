import { useMemo } from "react"
import { Wallet } from "lucide-react"
import { trpc } from "@web/trpc"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import type { Category } from "@web/types"

type Props = {
  categories: Category[]
}

// Month-to-date progress for each budget. Renders nothing when no budgets
// exist — the Settings → Budgets tab is where they're created.
const BudgetsCard = ({ categories }: Props) => {
  const budgetsQuery = trpc.budgets.list.useQuery()
  const budgets = budgetsQuery.data?.items ?? []

  const categoryName = useMemo(
    () => (id: number | null) =>
      id === null ? "Overall" : (categories.find((c) => c.id === id)?.name ?? "Category"),
    [categories]
  )

  if (!budgets.length) return null

  return (
    <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 pb-3">
        <Wallet className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Budgets this month</h2>
      </div>
      <div className="flex flex-col gap-3">
        {budgets.map((budget) => {
          const pct =
            budget.amountMinor > 0 ? (budget.spentMinor / budget.amountMinor) * 100 : 0
          const over = pct >= 100
          const warning = !over && pct >= 80
          return (
            <div key={budget.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{categoryName(budget.categoryId)}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  <span className={cn(over && "font-semibold text-expense")}>
                    {formatMoney(budget.spentMinor, budget.currency)}
                  </span>{" "}
                  / {formatMoney(budget.amountMinor, budget.currency)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    over ? "bg-expense" : warning ? "bg-expense/60" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default BudgetsCard
