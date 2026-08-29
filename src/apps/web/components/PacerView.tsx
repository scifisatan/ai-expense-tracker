import { useState } from "react"
import {
  Compass,
  Sliders,
  Sparkles,
  PiggyBank,
  Home,
  Heart,
  Tv,
  Zap,
  Gift,
  MoreHorizontal,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { Button } from "@web/components/ui/button"
import { cn } from "@web/lib/utils"
import StartCycleDialog from "./StartCycleDialog"
import EditAllocationsDialog from "./EditAllocationsDialog"
import CycleReviewDialog from "./CycleReviewDialog"

const PRESET_ICONS: Record<string, typeof Home> = {
  rent: Home,
  savings: PiggyBank,
  want_fund: Gift,
  utilities: Zap,
  subscriptions: Tv,
  family: Heart,
  custom: MoreHorizontal
}

type Props = {
  onNavigate?: (view: "dashboard" | "pacer" | "savings" | "wishlist" | "transactions" | "settings") => void
}

export const PacerView = ({ onNavigate: _onNavigate }: Props) => {
  const { snapshot, lastCompleted, isLoading, startCycle, updateCycle } = usePacer()
  const [startOpen, setStartOpen] = useState(false)
  const [editAllocOpen, setEditAllocOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [quickSalary, setQuickSalary] = useState("")

  if (isLoading) {
    return <div className="h-96 w-full animate-pulse rounded-3xl border bg-card/60" />
  }

  const currency = snapshot?.currency ?? "USD"

  if (!snapshot || !snapshot.active) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Daily Spending Pace</h1>
          <p className="text-xs text-muted-foreground">
            Automated off-the-top budgeting and daily discretionary allowance.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-10">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Compass className="size-7" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">No Active Pacing Cycle</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Set your income and off-the-top commitments (rent, savings, bills). The pacer splits what’s left evenly across every single day of the month.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Monthly income (e.g. 50,000)"
                value={quickSalary}
                onChange={(e) => setQuickSalary(e.target.value)}
                className="w-full rounded-2xl border bg-background px-4 py-2.5 text-sm font-semibold tabular outline-none focus:ring-2 focus:ring-primary/20 sm:w-64"
              />
              <Button
                onClick={() => {
                  const salary = Number(quickSalary)
                  const now = new Date()
                  const today = now.toISOString().slice(0, 10)
                  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                  startCycle({
                    startDate: today,
                    endDate: endOfMonth.toISOString().slice(0, 10),
                    gross: Number.isFinite(salary) && salary > 0 ? salary : 50000,
                    sweepPct: 50,
                    allocations: []
                  })
                }}
                className="w-full rounded-2xl sm:w-auto"
              >
                Start Pacer
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const {
    cycle,
    grossMinor,
    allocations,
    poolMinor,
    allowanceMinor,
    spentTodayMinor,
    remainingTodayMinor,
    daysRemainingInclusive
  } = snapshot

  const overspent = remainingTodayMinor < 0
  const spendPct = allowanceMinor > 0 ? Math.min(100, Math.round((spentTodayMinor / allowanceMinor) * 100)) : 0
  const totalAllocatedMinor = allocations.reduce((sum, a) => sum + a.amountMinor, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Daily Spending Pace</h1>
          <p className="text-xs text-muted-foreground">
            Discretionary allowance with dynamic overspend smoothing and underspend sweeps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditAllocOpen(true)}
            className="h-9 gap-1.5 rounded-2xl text-xs font-semibold"
          >
            <Sliders className="size-3.5" />
            Edit Allocations & Duration
          </Button>
          {lastCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewOpen(true)}
              className="h-9 gap-1.5 rounded-2xl text-xs font-semibold"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              Last Cycle Review
            </Button>
          )}
        </div>
      </div>

      {/* Main Today's Allowance Hero */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-foreground">Today's Discretionary Allowance</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {daysRemainingInclusive} day{daysRemainingInclusive === 1 ? "" : "s"} left in cycle
            </span>
          </div>

          <div className="mt-4">
            <p className="tabular text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {formatMoney(Math.max(0, remainingTodayMinor), currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {overspent
                ? `Overspent by ${formatMoney(Math.abs(remainingTodayMinor), currency)} today. Automatically amortized across future days.`
                : `Spent ${formatMoney(spentTodayMinor, currency)} of ${formatMoney(allowanceMinor, currency)} daily budget.`}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Today's spend progress</span>
              <span className="tabular font-semibold">{spendPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  overspent ? "bg-rose-500" : spendPct > 80 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${overspent ? 100 : spendPct}%` }}
              />
            </div>
          </div>

          {/* Micro stats */}
          <div className="mt-6 grid grid-cols-3 gap-3 border-t pt-5">
            <div className="rounded-2xl bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">Daily Allowance</span>
              <p className="tabular mt-1 text-sm font-semibold text-foreground">
                {formatMoney(allowanceMinor, currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">Spent Today</span>
              <p className="tabular mt-1 text-sm font-semibold text-foreground">
                {formatMoney(spentTodayMinor, currency)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">Cycle Pool</span>
              <p className="tabular mt-1 text-sm font-semibold text-foreground">
                {formatMoney(poolMinor, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Pacing Rules & Automation Card */}
        <div className="flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm sm:p-8 lg:col-span-5">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Pacer Automation Rules</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
                <ShieldCheck className="mt-0.5 size-4 text-emerald-500 shrink-0" />
                <div>
                  <strong className="text-foreground">Off-the-top Protection</strong>
                  <p className="text-muted-foreground">Rent, savings, and bills are quarantined first before daily allowance is calculated.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
                <CheckCircle2 className="mt-0.5 size-4 text-purple-500 shrink-0" />
                <div>
                  <strong className="text-foreground">Daily Underspend Sweep ({cycle.sweepPct ?? 50}%)</strong>
                  <p className="text-muted-foreground">Whatever is unspent at midnight sweeps automatically to fund your Priority Wishlist items.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
                <AlertCircle className="mt-0.5 size-4 text-amber-500 shrink-0" />
                <div>
                  <strong className="text-foreground">Smooth Overspend Amortization</strong>
                  <p className="text-muted-foreground">Overspending today is spread out evenly across the rest of the cycle instead of zeroing out tomorrow.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs">
            <span className="text-muted-foreground">Want Fund Underspend Sweep</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{cycle.sweepPct ?? 50}%</span>
          </div>
        </div>
      </div>

      {/* Off-the-top Allocations Breakdown */}
      <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Off-The-Top Monthly Allocations</h2>
            <p className="text-xs text-muted-foreground">Fixed commitments deducted from gross income before daily pacing.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditAllocOpen(true)}
            className="h-8 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Sliders className="size-3.5" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Gross Income</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">100%</span>
            </div>
            <p className="tabular mt-2 text-xl font-extrabold text-foreground">
              {formatMoney(grossMinor, currency)}
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Deducted</span>
              <span className="font-semibold text-rose-500">
                {grossMinor > 0 ? Math.round((totalAllocatedMinor / grossMinor) * 100) : 0}%
              </span>
            </div>
            <p className="tabular mt-2 text-xl font-extrabold text-foreground">
              {formatMoney(totalAllocatedMinor, currency)}
            </p>
          </div>

          <div className="rounded-2xl border bg-primary/5 p-4 border-primary/20">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="text-primary font-semibold">Discretionary Pool</span>
              <span className="font-bold text-primary">
                {grossMinor > 0 ? Math.round((poolMinor / grossMinor) * 100) : 0}%
              </span>
            </div>
            <p className="tabular mt-2 text-xl font-extrabold text-primary">
              {formatMoney(poolMinor, currency)}
            </p>
          </div>
        </div>

        {/* Individual Allocations List */}
        <div className="mt-5 space-y-2">
          {allocations.map((a) => {
            const Icon = PRESET_ICONS[a.kind] ?? MoreHorizontal
            const pct = grossMinor > 0 ? Math.round((a.amountMinor / grossMinor) * 100) : 0
            return (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-background text-foreground shadow-xs">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <strong className="text-sm font-semibold text-foreground">{a.label}</strong>
                    <p className="text-[11px] text-muted-foreground capitalize">{a.kind.replace("_", " ")}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="tabular text-sm font-bold text-foreground">
                    {formatMoney(a.amountMinor, currency)}
                  </p>
                  <span className="text-[11px] text-muted-foreground">{pct}% of income</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dialogs */}
      <StartCycleDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        onStart={startCycle}
      />
      <EditAllocationsDialog
        open={editAllocOpen}
        onOpenChange={setEditAllocOpen}
        cycleId={cycle.id}
        currency={currency}
        initialGross={grossMinor ? grossMinor / 100 : 0}
        initialEndDate={cycle.endAt ? new Date(cycle.endAt).toISOString().slice(0, 10) : undefined}
        initialSweepPct={cycle.sweepPct ?? 50}
        initialAllocations={allocations ?? []}
        onSave={updateCycle}
      />
      <CycleReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onRollover={(prefill) => {
          setReviewOpen(false)
          startCycle({
            startDate: prefill.startDate,
            endDate: prefill.endDate,
            gross: prefill.gross,
            sweepPct: prefill.sweepPct,
            allocations: prefill.allocations
          })
        }}
      />
    </div>
  )
}

export default PacerView
