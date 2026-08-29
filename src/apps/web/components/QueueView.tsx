import { useEffect, useState } from "react"
import { Plus, Gift, Check, X } from "lucide-react"
import { Reorder } from "framer-motion"
import { useQueue } from "@web/hooks/useQueue"
import type { QueueItem } from "@web/types"
import { formatMoney } from "@web/helper"
import { calculateQueueAffordability } from "@/shared/allowance"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import QueueItemRow from "./QueueItemRow"

type Props = {
  currency: string
}

const DEFAULT_TAGS = ["Gift", "Essential", "Urgent"]

export const QueueView = ({ currency }: Props) => {
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>(DEFAULT_TAGS)
  const [selectedTag, setSelectedTag] = useState<string>("Gift")
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")

  const {
    items: serverItems,
    currentBalanceMinor,
    projectedDailySweepMinor,
    addItem,
    reorder,
    reorderList,
    purchase,
    removeItem
  } = useQueue("want")

  const [localItems, setLocalItems] = useState<QueueItem[]>([])

  useEffect(() => {
    setLocalItems(serverItems)

    // Extract any existing tags from loaded items
    const customFound = new Set<string>(DEFAULT_TAGS)
    serverItems.forEach((it) => {
      const match = it.title.match(/^\[([^\]]+)\]/)
      if (match && match[1]) {
        const t = match[1].trim()
        const formatted = t.charAt(0).toUpperCase() + t.slice(1)
        customFound.add(formatted)
      }
    })
    setAvailableTags(Array.from(customFound))
  }, [serverItems])

  const priceValue = Number(price)
  const canAdd = Boolean(title.trim()) && Number.isFinite(priceValue) && priceValue > 0

  const handleCreateNewTag = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTagInput.trim()
    if (!trimmed) return
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    if (!availableTags.includes(formatted)) {
      setAvailableTags((prev) => [...prev, formatted])
    }
    setSelectedTag(formatted)
    setNewTagInput("")
    setIsAddingTag(false)
  }

  const submitNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    const fullTitle = `[${selectedTag}] ${title.trim()}`
    const coolingDays = selectedTag.toLowerCase() === "urgent" ? 0 : selectedTag.toLowerCase() === "essential" ? 1 : 3
    const ok = await addItem({ title: fullTitle, price: priceValue, coolingDays })
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
          <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Gift className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Wishlist fund balance
            </p>
            <p className="tabular text-xl font-extrabold text-foreground">
              {formatMoney(currentBalanceMinor, currency)}
            </p>
          </div>
        </div>

        {projectedDailySweepMinor > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Daily pace surplus</p>
            <p className="tabular text-sm font-bold text-emerald-600 dark:text-emerald-400">
              +{formatMoney(projectedDailySweepMinor, currency)}/day
            </p>
          </div>
        )}
      </div>

      {/* Priority Wishlist Card */}
      <div className="space-y-4 rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Priority wishlist items</h3>
            <p className="text-xs text-muted-foreground">
              Ranked items funded automatically by daily underspend sweeps. Drag or use arrows to prioritize.
            </p>
          </div>

          <span className="text-xs text-muted-foreground">
            {localItems.length} item{localItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Tag Selector & Add Form */}
        <form onSubmit={submitNewItem} className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-xs font-semibold text-muted-foreground">Tag:</span>
            {availableTags.map((tag) => {
              const isSelected = selectedTag === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                    isSelected
                      ? tag.toLowerCase() === "urgent"
                        ? "border-rose-500 bg-rose-500 text-white"
                        : tag.toLowerCase() === "essential"
                          ? "border-blue-500 bg-blue-500 text-white"
                          : tag.toLowerCase() === "gift"
                            ? "border-purple-500 bg-purple-500 text-white"
                            : "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              )
            })}

            {/* Inline Add Custom Tag */}
            {isAddingTag ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="New tag"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleCreateNewTag(e)
                    }
                  }}
                  className="h-6 w-24 rounded-full border bg-background px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateNewTag}
                  className="rounded-full bg-primary p-1 text-primary-foreground hover:opacity-90"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTag(false)
                    setNewTagInput("")
                  }}
                  className="rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-3" /> Add tag
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. Mechanical Keyboard, Winter Jacket, Vacation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-sm"
            />
            <Input
              className="w-28 text-sm font-semibold tabular"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Button type="submit" disabled={!canAdd} className="gap-1 text-xs font-semibold">
              <Plus className="size-4" /> Add item
            </Button>
          </div>
        </form>

        {/* Reorderable Items List */}
        {localItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Your wishlist is empty.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Add goals and desires above. Daily underspend sweeps will automatically fund them in order of priority!
            </p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={localItems} onReorder={handleReorder} className="space-y-2">
            {localItems.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                index={index}
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
