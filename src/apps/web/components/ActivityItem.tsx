import { useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { Category, Transaction, TxUpdatePatch } from "@web/types"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import { Button } from "@web/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@web/components/ui/dropdown-menu"
import TransactionDialog from "./TransactionDialog"

type Props = {
  tx: Transaction
  categories: Category[]
  currency: string
  onUpdate: (tx: Transaction, patch: TxUpdatePatch) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

const ActivityItem = ({ tx, categories, currency, onUpdate, onDelete }: Props) => {
  const [editOpen, setEditOpen] = useState(false)

  const categoryName = useMemo(
    () => categories.find((c) => c.id === tx.categoryId)?.name ?? null,
    [categories, tx.categoryId]
  )

  const income = tx.type === "Income"
  const title = tx.note || categoryName || tx.type
  const subtitle = tx.note && categoryName ? categoryName : income ? "Income" : "Expense"

  const time = useMemo(() => {
    try {
      return new Date(tx.occurredAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      })
    } catch {
      return ""
    }
  }, [tx.occurredAt])

  const confirmDelete = () => {
    if (confirm("Delete this transaction?")) void onDelete(tx.id)
  }

  return (
    <>
      <div className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-muted/60">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            income ? "bg-income-muted text-income" : "bg-expense-muted text-expense"
          )}
        >
          {income ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {subtitle}
            {time ? ` · ${time}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "tabular shrink-0 text-sm font-semibold",
            income ? "text-income" : "text-foreground"
          )}
        >
          {income ? "+" : "−"}
          {formatMoney(tx.amountMinor, tx.currency)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label="Transaction actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={confirmDelete}
            >
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TransactionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={tx}
        categories={categories}
        currency={currency}
        onUpdate={onUpdate}
        onDelete={() => {
          confirmDelete()
          setEditOpen(false)
        }}
      />
    </>
  )
}

export default ActivityItem
