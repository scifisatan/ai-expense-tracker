import { useEffect, useState } from "react"
import { Plus, Sparkles, ShieldCheck } from "lucide-react"
import { Reorder } from "framer-motion"
import { useQueue } from "@web/hooks/useQueue"
import type { QueueItem, QueueKind } from "@web/types"
import { cn } from "@web/lib/utils"
import { formatMoney } from "@web/helper"
import { calculateQueueAffordability } from "@/shared/allowance"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import QueueItemRow from "./QueueItemRow"

type Props = {
  currency: string
}

const KINDS: { value: QueueKind; label: string }[] = [
  { value: "want", label: "Wants" },
  { value: "need", label: "Needs" }
]

export const QueueView = ({ currency }: Props) => {
  const [kind, setKind] = useState<QueueKind>("want")
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")

  const {
    items: serverItems,
    currentBalanceMinor,
    projectedDailySweepMinor,
    addItem,
    reorder,
    reorderList,
    purchase,
    removeItem
  } = useQueue(kind)

  const [localItems, setLocalItems] = useState<QueueItem[]>([])

  useEffect(() => {
    setLocalItems(serverItems)
  }, [serverItems])

  const priceValue = Number(price)
  const canAdd = Boolean(title.trim()) && Number.isFinite(priceValue) && priceValue > 0

  const submitNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    const ok = await addItem({ title: title.trim(), price: priceValue })
    if (ok) {
      setTitle("")
      setPrice("")
    }
  }

  const handleReorder = (newOrder: QueueItem[]) => {
    let movedItemId: number | null = null
    for (let i = 0; i < newOrder.length; i++) {
      if (newOrder[i]?.id !== localItems[i]?.id) {
        movedItemId = newOrder[i]?.id ?? null
        break
      }
    }

    const affMap = calculateQueueAffordability(newOrder, currentBalanceMinor, projectedDailySweepMinor)
    const updated = newOrder.map((item) => {
      const aff = affMap.get(item.id)
      return {
        ...item,
        daysToAfford: aff?.daysToAfford ?? null,
        cumulativePriceMinor: aff?.cumulativePriceMinor ?? item.priceMinor
      }
    })

    setLocalItems(updated)

    if (movedItemId !== null) {
      void reorderList(newOrder, movedItemId)
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const afterId = index >= 2 ? (localItems[index - 2]?.id ?? null) : null
    void reorder(localItems[index]!.id, afterId)
  }

  const moveDown = (index: number) => {
    if (index === localItems.length - 1) return
    void reorder(localItems[index]!.id, localItems[index + 1]!.id)
  }

  return (
    <div className="space-y-4">
      {/* Top Fund Status Banner */}
      <div className="flex items-center justify-between rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-2xl",
              kind === "want"
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            {kind === "want" ? <Sparkles className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {kind === "want" ? "Want Fund Balance" : "Needs Reserve"}
            </p>
            <p className="tabular text-xl font-extrabold text-foreground">
              {formatMoney(currentBalanceMinor, currency)}
            </p>
          </div>
        </div>

        {kind === "want" && projectedDailySweepMinor > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Daily Accumulation</p>
            <p className="tabular text-sm font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(projectedDailySweepMinor, currency)}/day
            </p>
          </div>
        )}
      </div>

      {/* Track selector + Form in Card */}
      <div className="space-y-4 rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
            {KINDS.map((k) => (
              <Button
                key={k.value}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setKind(k.value)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-semibold",
                  kind === k.value
                    ? "bg-card text-foreground shadow-sm hover:bg-card"
                    : "text-muted-foreground"
                )}
              >
                {k.label}
              </Button>
            ))}
          </div>

          <span className="text-xs text-muted-foreground">
            {localItems.length} item{localItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Add new queue item form */}
        <form onSubmit={submitNewItem} className="flex items-center gap-2">
          <Input
            placeholder={kind === "want" ? "e.g. Mechanical Keyboard" : "e.g. Health Insurance"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-sm"
          />
          <Input
            className="w-28 text-sm"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button type="submit" disabled={!canAdd} className="gap-1 text-xs font-semibold">
            <Plus className="size-4" /> Add to {kind === "want" ? "Wants" : "Needs"}
          </Button>
        </form>

        {/* Reorderable Items List */}
        {localItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Nothing queued in {kind === "want" ? "Wants" : "Needs"} yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              {kind === "want"
                ? "Add things you desire. Daily underspend sweeps will automatically fund them."
                : "Add essential items that draw from your standing reserve."}
            </p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={localItems} onReorder={handleReorder} className="space-y-2">
            {localItems.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                currency={currency}
                canMoveUp={index > 0}
                canMoveDown={index < localItems.length - 1}
                onMoveUp={() => moveUp(index)}
                onMoveDown={() => moveDown(index)}
                onPurchase={() => void purchase(item.id)}
                onRemove={() => void removeItem(item.id)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  )
}
