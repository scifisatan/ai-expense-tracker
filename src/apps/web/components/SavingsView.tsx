import { useState } from "react"
import {
  Plus,
  ShieldCheck,
  TrendingUp,
  Lock,
  Sparkles
} from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { Button } from "@web/components/ui/button"
import DepositSavingsDialog from "./DepositSavingsDialog"

type Props = {
  onNavigate?: (view: "dashboard" | "pacer" | "savings" | "wishlist" | "transactions" | "settings") => void
}

export const SavingsView = ({ onNavigate: _onNavigate }: Props) => {
  const { snapshot, isLoading, depositSavings } = usePacer()
  const [depositOpen, setDepositOpen] = useState(false)

  if (isLoading) {
    return <div className="h-96 w-full animate-pulse rounded-3xl border bg-card/60" />
  }

  const currency = snapshot?.currency ?? "USD"
  const totalSavings = snapshot?.accumulatedSavingsMinor ?? 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Savings Vault</h1>
          <p className="text-xs text-muted-foreground">
            Off-the-top protected wealth reserve that accumulates across months.
          </p>
        </div>

        <Button
          onClick={() => setDepositOpen(true)}
          className="gap-1.5 rounded-2xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          <Plus className="size-4" />
          Deposit to Vault
        </Button>
      </div>

      {/* Hero Card */}
      <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-card via-card to-emerald-500/5 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
              <span>Protected Wealth Reserve</span>
            </div>
            <p className="tabular mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {formatMoney(totalSavings, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total lifetime accumulated savings across all cycles and manual deposits.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              size="lg"
              onClick={() => setDepositOpen(true)}
              className="gap-2 rounded-2xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <Plus className="size-4" />
              + Quick Deposit
            </Button>
            <span className="text-[11px] text-muted-foreground">Instant deposit into protected vault</span>
          </div>
        </div>
      </div>

      {/* 3 Pillars of Vault Protection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Lock className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Quarantined from Daily Spend</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Vault money is excluded from your daily discretionary allowance so you never accidentally spend it.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <TrendingUp className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Lifetime Accumulation</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Unlike discretionary allowances which reset monthly, savings roll over seamlessly forever.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Sparkles className="size-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Automatic Monthly Contributions</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Budget an off-the-top "Savings Vault" allocation every month to automatically build wealth with zero effort.
          </p>
        </div>
      </div>

      {/* Dialogs */}
      <DepositSavingsDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        currency={currency}
        onDeposit={depositSavings}
      />
    </div>
  )
}

export default SavingsView
