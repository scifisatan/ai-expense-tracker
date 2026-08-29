import { useState } from "react"
import { PiggyBank, Plus } from "lucide-react"
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  onDeposit: (input: { amount: number; note?: string }) => Promise<boolean>
}

const QUICK_AMOUNTS = [500, 1000, 5000, 10000]

export const DepositSavingsDialog = ({ open, onOpenChange, currency, onDeposit }: Props) => {
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const numAmount = Number(amount)
  const isValid = Number.isFinite(numAmount) && numAmount > 0

  const handleQuickAdd = (val: number) => {
    const current = Number(amount) || 0
    setAmount(String(current + val))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    try {
      const ok = await onDeposit({
        amount: numAmount,
        note: note.trim() || undefined
      })
      if (ok) {
        setAmount("")
        setNote("")
        onOpenChange(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <PiggyBank className="size-5" />
              </div>
              <div>
                <DialogTitle>Deposit to Savings Vault</DialogTitle>
                <DialogDescription>
                  Lock away funds into your accumulated savings vault.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount">Deposit Amount ({currency})</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  {currency}
                </span>
                <Input
                  id="deposit-amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-14 text-lg font-bold tabular"
                  autoFocus
                  required
                />
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAdd(val)}
                    className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    +{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deposit-note">Note / Purpose (optional)</Label>
              <Input
                id="deposit-note"
                placeholder="e.g. Monthly top-up, Freelance profit, Bonus"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || loading} className="gap-1.5">
              <Plus className="size-4" />
              {loading ? "Depositing…" : "Deposit Funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DepositSavingsDialog
