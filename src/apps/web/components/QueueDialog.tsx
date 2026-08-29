import { useState } from "react"
import { Plus } from "lucide-react"
import { useQueue } from "@web/hooks/useQueue"
import type { QueueKind } from "@web/types"
import { cn } from "@web/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import QueueItemRow from "./QueueItemRow"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
}

const KINDS: { value: QueueKind; label: string }[] = [
  { value: "want", label: "Wants" },
  { value: "need", label: "Needs" }
]

// Needs/wants queue: reorder, purchase against the matching fund, or drop an
// item. One tRPC call per kind, switched by the toggle above the list.
const QueueDialog = ({ open, onOpenChange, currency }: Props) => {
  const [kind, setKind] = useState<QueueKind>("want")
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")

  const { items, addItem, reorder, purchase, removeItem } = useQueue(kind)

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

  const moveUp = (index: number) => {
    if (index === 0) return
    const afterId = index >= 2 ? (items[index - 2]?.id ?? null) : null
    void reorder(items[index]!.id, afterId)
  }

  const moveDown = (index: number) => {
    if (index === items.length - 1) return
    void reorder(items[index]!.id, items[index + 1]!.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Needs & Wants</DialogTitle>
          <DialogDescription>
            Wants draw from the Want Fund once their cooling-off period ends. Needs draw from the
            reserve set aside at the start of the cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-1 self-start rounded-full bg-muted p-1">
          {KINDS.map((k) => (
            <Button
              key={k.value}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setKind(k.value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs",
                kind === k.value
                  ? "bg-card text-foreground shadow-sm hover:bg-card"
                  : "text-muted-foreground"
              )}
            >
              {k.label}
            </Button>
          ))}
        </div>

        <form onSubmit={submitNewItem} className="flex items-center gap-2">
          <Input
            placeholder={kind === "want" ? "Headphones" : "New shoes"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Input
            className="w-24"
            inputMode="decimal"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={!canAdd} aria-label="Add to queue">
            <Plus className="size-4" />
          </Button>
        </form>

        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            Nothing queued yet.
          </p>
        ) : (
          <div className="space-y-0.5">
            {items.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                currency={currency}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
                onMoveUp={() => moveUp(index)}
                onMoveDown={() => moveDown(index)}
                onPurchase={() => void purchase(item.id)}
                onRemove={() => void removeItem(item.id)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default QueueDialog
