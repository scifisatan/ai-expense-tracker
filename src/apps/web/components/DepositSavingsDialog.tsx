import { useState } from "react"
import { PiggyBank, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, ShieldCheck } from "lucide-react"
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
import { cn } from "@web/lib/utils"

export type TransferSource = "balance_to_savings" | "savings_to_balance" | "direct_deposit"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  onDeposit: (input: {
    amount: number
    source?: TransferSource
    note?: string
  }) => Promise<boolean>
}

const QUICK_AMOUNTS = [500, 1000, 5000, 10000]

export const DepositSavingsDialog = ({ open, onOpenChange, currency, onDeposit }: Props) => {
  const [source, setSource] = useState<TransferSource>("balance_to_savings")
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
        source,
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
                {source === "savings_to_balance" ? (
                  <ArrowDownLeft className="size-5" />
                ) : source === "balance_to_savings" ? (
                  <ArrowUpRight className="size-5" />
                ) : (
                  <PiggyBank className="size-5" />
                )}
              </div>
              <div>
                <DialogTitle>
                  {source === "savings_to_balance"
                    ? "Withdraw to Main Balance"
                    : source === "balance_to_savings"
                      ? "Transfer from Main Balance"
                      : "Direct Deposit to Vault"}
                </DialogTitle>
                <DialogDescription>
                  {source === "balance_to_savings"
                    ? "Transfer cash from your available balance into the protected vault."
                    : source === "savings_to_balance"
                      ? "Withdraw savings back into your active spending balance."
                      : "Add external funds or existing savings without touching main balance."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Transfer Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setSource("balance_to_savings")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 px-1 text-center font-semibold transition-all",
                source === "balance_to_savings"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="size-3.5 text-emerald-500" />
              <span>From Balance</span>
            </button>
            <button
              type="button"
              onClick={() => setSource("direct_deposit")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 px-1 text-center font-semibold transition-all",
                source === "direct_deposit"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldCheck className="size-3.5 text-blue-500" />
              <span>Direct / External</span>
            </button>
            <button
              type="button"
              onClick={() => setSource("savings_to_balance")}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 px-1 text-center font-semibold transition-all",
                source === "savings_to_balance"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownLeft className="size-3.5 text-purple-500" />
              <span>To Balance</span>
            </button>
          </div>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount">Amount ({currency})</Label>
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
              <Label htmlFor="deposit-note">Note / Description (optional)</Label>
              <Input
                id="deposit-note"
                placeholder={
                  source === "savings_to_balance"
                    ? "e.g. Vacation expense, Emergency withdrawal"
                    : source === "balance_to_savings"
                      ? "e.g. Monthly surplus, Salary savings"
                      : "e.g. Existing savings balance, Bank deposit"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || loading}
              className={cn(
                "gap-1.5 font-semibold text-white",
                source === "savings_to_balance"
                  ? "bg-purple-600 hover:bg-purple-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              <ArrowRightLeft className="size-4" />
              {loading
                ? "Processing…"
                : source === "savings_to_balance"
                  ? "Withdraw Funds"
                  : source === "balance_to_savings"
                    ? "Transfer from Balance"
                    : "Deposit to Vault"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default DepositSavingsDialog
