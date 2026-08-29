import { GripVertical, ChevronDown, ChevronUp, ShoppingBag, X, Clock, CheckCircle2, Check } from "lucide-react"
import { toast } from "sonner"
import { Reorder, useDragControls } from "framer-motion"
import type { QueueItem } from "@web/types"
import { formatMoney } from "@web/helper"
import { Button } from "@web/components/ui/button"
import { cn } from "@web/lib/utils"

type Props = {
  item: QueueItem
  index: number
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

const parseTitleAndTag = (rawTitle: string): { tag: string | null; cleanTitle: string } => {
  const match = rawTitle.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (match && match[1]) {
    const rawTag = match[1].trim()
    const formatted = rawTag.charAt(0).toUpperCase() + rawTag.slice(1)
    return {
      tag: formatted,
      cleanTitle: match[2] || rawTitle
    }
  }
  return { tag: null, cleanTitle: rawTitle }
}

const QueueItemRow = ({
  item,
  index,
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
  const { tag, cleanTitle } = parseTitleAndTag(item.title)

  const confirmPurchase = () => {
    if (confirm(`Mark "${cleanTitle}" as purchased?`)) onPurchase()
  }
  const confirmReceived = () => {
    if (confirm(`Mark "${cleanTitle}" as received (e.g. gifted / acquired) without spending your wishlist fund?`)) {
      onRemove()
      toast.success(`🎉 Marked "${cleanTitle}" as received!`)
    }
  }
  const confirmRemove = () => {
    if (confirm(`Remove "${cleanTitle}" from the queue?`)) onRemove()
  }

  return (
    <Reorder.Item
      value={item}
      id={String(item.id)}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "group relative flex select-none items-center gap-2.5 rounded-2xl border border-transparent bg-card/60 px-3 py-2.5 shadow-sm transition-all hover:border-border/60 hover:bg-muted/50",
        status.isReady && "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/15"
      )}
    >
      {/* Priority Rank Badge (#1, #2, etc.) */}
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold",
          index === 0
            ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
            : "bg-muted text-muted-foreground"
        )}
        title={`Priority #${index + 1}`}
      >
        #{index + 1}
      </span>

      {/* Drag handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground active:cursor-grabbing"
        title="Drag to prioritize"
      >
        <GripVertical className="size-4" />
      </div>

      {/* Up/Down buttons for mobile/keyboard */}
      <div className="flex shrink-0 flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-4 text-muted-foreground hover:text-foreground"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          title="Move priority up"
          aria-label="Move priority up"
        >
          <ChevronUp className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-4 text-muted-foreground hover:text-foreground"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          title="Move priority down"
          aria-label="Move priority down"
        >
          <ChevronDown className="size-3" />
        </Button>
      </div>

      {/* Title & Affordability Status */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {tag && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                tag.toLowerCase() === "urgent" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30",
                tag.toLowerCase() === "essential" && "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
                tag.toLowerCase() === "gift" && "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30",
                !["urgent", "essential", "gift"].includes(tag.toLowerCase()) && "bg-muted text-foreground border border-border"
              )}
            >
              {tag}
            </span>
          )}
          <p className="truncate text-sm font-semibold text-foreground">{cleanTitle}</p>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          {status.isCoolingOff ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Clock className="size-3" />
              {status.text}
            </span>
          ) : status.isReady ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Affordable now
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">{status.text}</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="tabular text-sm font-bold text-foreground">
          {formatMoney(item.priceMinor, currency)}
        </p>
      </div>

      {/* Purchase / Remove Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {status.isReady && (
          <Button
            size="sm"
            onClick={confirmPurchase}
            className="h-8 gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            <ShoppingBag className="size-3.5" />
            Buy
          </Button>
        )}
        {/* Check off as Received (Gifted / Free) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={confirmReceived}
          className="size-8 rounded-xl text-muted-foreground/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400"
          title="Mark as received (gifted / free)"
          aria-label="Mark as received"
        >
          <Check className="size-4" />
        </Button>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={confirmRemove}
          className="size-8 rounded-xl text-muted-foreground/60 transition-colors hover:text-destructive"
          title="Remove from wishlist"
          aria-label="Remove item"
        >
          <X className="size-4" />
        </Button>
      </div>
    </Reorder.Item>
  )
}

export default QueueItemRow
