import { useMemo } from "react"
import { Receipt, Search } from "lucide-react"
import type { Category, Transaction, TxUpdatePatch } from "@web/types"
import { useTransactionFilter } from "@web/hooks/useTransactionFilter"
import { cn } from "@web/lib/utils"
import { Input } from "@web/components/ui/input"
import { Button } from "@web/components/ui/button"
import { Skeleton } from "@web/components/ui/skeleton"
import ActivityItem from "./ActivityItem"

type Props = {
  transactions: Transaction[]
  categories: Category[]
  currency: string
  isLoading: boolean
  onUpdate: (tx: Transaction, patch: TxUpdatePatch) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const dayLabel = (d: Date): string => {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric"
  })
}

const TYPES = ["All", "Income", "Expense"] as const

const ActivityFeed = ({ transactions, categories, currency, isLoading, onUpdate, onDelete }: Props) => {
  const { search, setSearch, typeFilter, setTypeFilter, filtered } =
    useTransactionFilter(transactions)

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Transaction[] }>()
    for (const tx of filtered) {
      const key = new Date(tx.occurredAt).toDateString()
      if (!map.has(key)) map.set(key, { label: dayLabel(new Date(tx.occurredAt)), items: [] })
      map.get(key)!.items.push(tx)
    }
    return [...map.values()]
  }, [filtered])

  return (
    <section className="rounded-3xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 px-1 pb-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold">Activity</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-9 rounded-full pl-8"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
            {TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs",
                  typeFilter === t
                    ? "bg-card text-foreground shadow-sm hover:bg-card"
                    : "text-muted-foreground"
                )}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1 p-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Receipt className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {transactions.length === 0 ? "No transactions yet" : "Nothing matches"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {transactions.length === 0
                ? "Add your first one with the box above."
                : "Try a different search or filter."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 px-1 pb-1">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((tx) => (
                  <ActivityItem
                    key={tx.id}
                    tx={tx}
                    categories={categories}
                    currency={currency}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default ActivityFeed
