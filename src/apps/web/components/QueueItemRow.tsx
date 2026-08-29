import { ChevronDown, ChevronUp, ShoppingBag, X } from "lucide-react"
import type { QueueItem } from "@web/types"
import { formatMoney } from "@web/helper"
import { Button } from "@web/components/ui/button"

type Props = {
  item: QueueItem
  currency: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onPurchase: () => void
  onRemove: () => void
}

const affordabilityLabel = (item: QueueItem): string => {
  if (item.coolingUntil && item.coolingUntil > new Date().toLocaleDateString("en-CA")) {
    return `Cooling off until ${item.coolingUntil}`
  }
  if (item.daysToAfford === null) return "Not affordable at the current pace"
  if (item.daysToAfford === 0) return "Affordable now"
  return `~${item.daysToAfford} day${item.daysToAfford === 1 ? "" : "s"} away`
}

const QueueItemRow = ({
  item,
  currency,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onPurchase,
  onRemove
}: Props) => {
  const confirmPurchase = () => {
    if (confirm(`Mark "${item.title}" as purchased?`)) onPurchase()
  }
  const confirmRemove = () => {
    if (confirm(`Remove "${item.title}" from the queue?`)) onRemove()
  }

  return (
    <div className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/60">
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{affordabilityLabel(item)}</p>
      </div>

      <span className="tabular shrink-0 text-sm font-semibold text-foreground">
        {formatMoney(item.priceMinor, currency)}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={confirmPurchase}
        aria-label="Mark purchased"
      >
        <ShoppingBag className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={confirmRemove}
        aria-label="Remove from queue"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

export default QueueItemRow
