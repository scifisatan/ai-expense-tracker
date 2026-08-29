import { GripVertical, ChevronDown, ChevronUp, ShoppingBag, X, Clock, CheckCircle2 } from "lucide-react"
import { Reorder, useDragControls } from "framer-motion"
import type { QueueItem } from "@web/types"
import { formatMoney } from "@web/helper"
import { Button } from "@web/components/ui/button"
import { cn } from "@web/lib/utils"

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

const isCooling = (item: QueueItem): boolean => {
  return Boolean(item.coolingUntil && item.coolingUntil > new Date().toLocaleDateString("en-CA"))
}

const affordabilityLabel = (item: QueueItem): { text: string; isReady: boolean; isCoolingOff: boolean } => {
  if (isCooling(item)) {
    return { text: `Cooling until ${item.coolingUntil}`, isReady: false, isCoolingOff: true }
  }
  if (item.daysToAfford === null) {
    return { text: "Not affordable at current pace", isReady: false, isCoolingOff: false }
  }
  if (item.daysToAfford === 0) {
    return { text: "Affordable now", isReady: true, isCoolingOff: false }
  }
  return {
    text: `~${item.daysToAfford} day${item.daysToAfford === 1 ? "" : "s"} away`,
    isReady: false,
    isCoolingOff: false
  }
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
  const dragControls = useDragControls()
  const status = affordabilityLabel(item)

  const confirmPurchase = () => {
    if (confirm(`Mark "${item.title}" as purchased?`)) onPurchase()
  }
  const confirmRemove = () => {
    if (confirm(`Remove "${item.title}" from the queue?`)) onRemove()
  }

  return (
    <Reorder.Item
      value={item}
      id={String(item.id)}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "group relative flex select-none items-center gap-2.5 rounded-2xl border border-transparent bg-card/60 px-2.5 py-2.5 shadow-sm transition-all hover:border-border/60 hover:bg-muted/50",
        status.isReady && "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15"
      )}
    >
      {/* Drag handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center p-1 text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </div>

      {/* Up/Down buttons for mobile/keyboard */}
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-muted-foreground"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <ChevronDown className="size-3" />
        </Button>
      </div>

      {/* Title & Affordability Status */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {status.isCoolingOff && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              <Clock className="size-2.5" />
              {status.text}
            </span>
          )}
          {status.isReady && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-2.5" />
              {status.text}
            </span>
          )}
          {!status.isCoolingOff && !status.isReady && (
            <span className="text-xs text-muted-foreground">{status.text}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <span className="tabular shrink-0 text-sm font-bold text-foreground">
        {formatMoney(item.priceMinor, currency)}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {status.isReady ? (
          <Button
            variant="default"
            size="sm"
            className="h-7 bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600"
            onClick={confirmPurchase}
            title="Ready to buy with saved funds"
          >
            <ShoppingBag className="mr-1 size-3.5" /> Buy
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={confirmPurchase}
            disabled={status.isCoolingOff}
            title={status.isCoolingOff ? "Cooling off" : "Mark purchased"}
          >
            <ShoppingBag className="size-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          onClick={confirmRemove}
          title="Remove from queue"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </Reorder.Item>
  )
}

export default QueueItemRow
