import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import type { Category, Transaction, TxUpdatePatch } from "@web/types"
import type { TransactionType } from "@/shared/types"
import { fromMinor } from "@web/helper"
import { cn } from "@web/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Label } from "@web/components/ui/label"
import { Textarea } from "@web/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@web/components/ui/select"

const NO_CATEGORY = "none"

// Pull just the currency symbol (e.g. "$") so we can use it as a leading affordance
// on the amount field without divider noise.
const currencySymbol = (currency: string): string => {
  try {
    const part = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase()
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")
    return part?.value ?? currency.toUpperCase()
  } catch {
    return currency.toUpperCase()
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  currency: string
  mode: "create" | "edit"
  initial?: Transaction
  onCreate?: (input: {
    amount: number
    type: TransactionType
    categoryId?: number | null
    note?: string | null
  }) => Promise<boolean>
  onUpdate?: (tx: Transaction, patch: TxUpdatePatch) => Promise<void>
  onDelete?: (tx: Transaction) => void
}

// Shared add/edit form used by the command bar (create) and feed rows (edit).
const TransactionDialog = ({
  open,
  onOpenChange,
  categories,
  currency,
  mode,
  initial,
  onCreate,
  onUpdate,
  onDelete
}: Props) => {
  const [type, setType] = useState<TransactionType>("Expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [showError, setShowError] = useState(false)

  // Edit currency is fixed to the row's currency; create uses the account default.
  const activeCurrency = mode === "edit" && initial ? initial.currency : currency
  const symbol = useMemo(() => currencySymbol(activeCurrency), [activeCurrency])

  // Seed the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setShowError(false)
    if (mode === "edit" && initial) {
      setType(initial.type)
      setAmount(String(fromMinor(initial.amountMinor, initial.currency)))
      setCategoryId(initial.categoryId)
      setNote(initial.note ?? "")
    } else {
      setType("Expense")
      setAmount("")
      setCategoryId(null)
      setNote("")
    }
  }, [open, mode, initial])

  const typeCategories = categories.filter((c) => c.type === type)
  const income = type === "Income"
  const amountValue = Number(amount)
  const amountValid = Boolean(amount) && Number.isFinite(amountValue) && amountValue > 0

  const pickType = (next: TransactionType) => {
    setType(next)
    setCategoryId(null)
  }

  // Returns true if the entry was saved (so callers can decide whether to close
  // or keep the dialog open for another entry).
  const persist = async (): Promise<boolean> => {
    if (!amountValid) {
      setShowError(true)
      toast.error("Enter an amount greater than zero.")
      return false
    }
    setSaving(true)
    if (mode === "edit" && initial) {
      await onUpdate?.(initial, { amount: amountValue, type, categoryId, note: note || null })
      setSaving(false)
      return true
    }
    const ok = await onCreate?.({ amount: amountValue, type, categoryId, note: note || null })
    setSaving(false)
    return Boolean(ok)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await persist()
    if (ok) onOpenChange(false)
  }

  // Create-only fast path: save and reset the amount while keeping the type.
  const addAnother = async () => {
    const ok = await persist()
    if (!ok) return
    setAmount("")
    setNote("")
    setShowError(false)
    toast.success("Added — ready for the next one.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the details below."
              : "Record income or an expense by hand."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          {/* Type — segmented toggle with money semantics. */}
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <div
              role="radiogroup"
              aria-label="Transaction type"
              className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
            >
              {(["Expense", "Income"] as const).map((t) => {
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pickType(t)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      active
                        ? t === "Income"
                          ? "bg-income-muted text-income shadow-sm"
                          : "bg-expense-muted text-expense shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount — the hero field. */}
          <div className="grid gap-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-background px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring/40",
                showError && !amountValid && "border-expense"
              )}
            >
              <span
                className={cn(
                  "tabular text-2xl font-semibold",
                  income ? "text-income" : "text-expense"
                )}
              >
                {symbol}
              </span>
              <input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0.00"
                className={cn(
                  "tabular w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/50",
                  income ? "text-income" : "text-expense"
                )}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (showError) setShowError(false)
                }}
                autoFocus
              />
            </div>
            {showError && !amountValid && (
              <p className="text-xs text-expense">Enter an amount greater than zero.</p>
            )}
          </div>

          {/* Category — filtered to the active type, with colored type dots. */}
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select
              value={categoryId ? String(categoryId) : NO_CATEGORY}
              onValueChange={(v) => setCategoryId(v === NO_CATEGORY ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {typeCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          c.type === "Income" ? "bg-income" : "bg-expense"
                        )}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea
              id="tx-note"
              placeholder="e.g. Coffee with Sam"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {mode === "edit" && initial && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-expense hover:bg-expense-muted hover:text-expense sm:mr-auto"
                onClick={() => onDelete(initial)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : (
              mode === "create" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:mr-auto"
                  onClick={() => void addAnother()}
                  disabled={saving || !amountValid}
                >
                  Add another
                </Button>
              )
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !amountValid}>
                {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add transaction"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionDialog
