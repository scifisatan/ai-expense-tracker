import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Category, Transaction, TxUpdatePatch } from "@web/types"
import type { TransactionType } from "@/shared/types"
import { fromMinor } from "@web/helper"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import { Label } from "@web/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@web/components/ui/select"

const NO_CATEGORY = "none"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  mode: "create" | "edit"
  initial?: Transaction
  onCreate?: (input: {
    amount: number
    type: TransactionType
    categoryId?: number | null
    note?: string | null
  }) => Promise<boolean>
  onUpdate?: (tx: Transaction, patch: TxUpdatePatch) => Promise<void>
}

// Shared add/edit form used by the command bar (create) and feed rows (edit).
const TransactionDialog = ({
  open,
  onOpenChange,
  categories,
  mode,
  initial,
  onCreate,
  onUpdate
}: Props) => {
  const [type, setType] = useState<TransactionType>("Expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  // Seed the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      toast.error("Enter an amount greater than zero.")
      return
    }
    setSaving(true)
    if (mode === "edit" && initial) {
      await onUpdate?.(initial, { amount: value, type, categoryId, note: note || null })
      setSaving(false)
      onOpenChange(false)
    } else {
      const ok = await onCreate?.({ amount: value, type, categoryId, note: note || null })
      setSaving(false)
      if (ok) onOpenChange(false)
    }
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v as TransactionType)
                  setCategoryId(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Expense">Expense</SelectItem>
                  <SelectItem value="Income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Amount</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0.00"
                className="tabular"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

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
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-note">Note</Label>
            <Input
              id="tx-note"
              placeholder="Optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionDialog
