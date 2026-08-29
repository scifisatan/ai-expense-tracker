import { useState } from "react"
import { CalendarClock, ListTodo, Compass, TrendingUp, CheckCircle2, Sliders, Gift } from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import { Button } from "@web/components/ui/button"
import { Skeleton } from "@web/components/ui/skeleton"
import StartCycleDialog from "./StartCycleDialog"
import { EditAllocationsDialog } from "./EditAllocationsDialog"
import QueueDialog from "./QueueDialog"
import CycleReviewDialog from "./CycleReviewDialog"
import type { AllocationKind } from "@/shared/types"
import DepositSavingsDialog from "./DepositSavingsDialog"

// The core Pacer loop: today's allowance, visual spending pace progress,
// the two funds, and nearest wishlist item. Offers cycle completion review & rollover.
const TodayCard = () => {
  const { snapshot, lastCompleted, isLoading, startCycle, updateCycle, depositSavings } = usePacer()
  const [startOpen, setStartOpen] = useState(false)
  const [editAllocOpen, setEditAllocOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [startPrefill, setStartPrefill] = useState<{
    startDate?: string
    endDate?: string
    gross?: number
    sweepPct?: number
    allocations?: { kind: AllocationKind; label: string; amount: number }[]
  } | null>(null)

  const handleStartWithPrefill = (prefill?: {
    startDate: string
    endDate?: string
    gross: number
    sweepPct: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => {
    if (prefill) {
      setStartPrefill(prefill)
    } else {
      setStartPrefill(null)
    }
    setStartOpen(true)
  }

  const [quickSalary, setQuickSalary] = useState("")

  const handleQuickStart = () => {
    const salaryNum = Number(quickSalary)
    const today = new Date().toISOString().slice(0, 10)
    const endDateObj = new Date()
    endDateObj.setDate(endDateObj.getDate() + 29)
    const endDate = endDateObj.toISOString().slice(0, 10)

    handleStartWithPrefill({
      startDate: today,
      endDate,
      gross: Number.isFinite(salaryNum) && salaryNum > 0 ? salaryNum : 0,
      sweepPct: 100,
      allocations: []
    })
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-40" />
      </section>
    )
  }

  if (!snapshot?.active) {
    return (
      <>
        <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Compass className="size-4 text-primary" />
            <span>No Active Cycle</span>
          </div>

          <p className="mt-3 text-sm text-foreground">
            Set your income and fixed expenses to get your daily spending allowance.
          </p>

          {!lastCompleted && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Monthly Salary / Income (e.g. 60000)"
                  value={quickSalary}
                  onChange={(e) => setQuickSalary(e.target.value)}
                  className="tabular h-11 flex-1 rounded-2xl border bg-background px-4 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
                />
                <Button
                  onClick={handleQuickStart}
                  className="h-11 gap-1.5 rounded-2xl px-5 text-xs font-bold"
                >
                  <Compass className="size-3.5" />
                  Start Pacing
                </Button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {[30000, 50000, 75000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setQuickSalary(String(amt))}
                      className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleStartWithPrefill({
                      startDate: new Date().toISOString().slice(0, 10),
                      gross: Number(quickSalary) || 0,
                      sweepPct: 100,
                      allocations: []
                    })
                  }
                  className="flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  <Sliders className="size-3.5" /> Custom Allocations (Rent, Savings)
                </button>
              </div>
            </div>
          )}

          {lastCompleted && (
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => setReviewOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Review previous cycle
              </Button>
              <Button
                onClick={() =>
                  handleStartWithPrefill({
                    startDate: new Date().toISOString().slice(0, 10),
                    gross: lastCompleted.cycle.grossMinor / 100,
                    sweepPct: lastCompleted.cycle.sweepPct,
                    allocations: lastCompleted.allocations.map((a) => ({
                      kind: a.kind,
                      label: a.label,
                      amount: a.amountMinor / 100
                    }))
                  })
                }
                className="gap-1.5 text-xs font-bold"
              >
                <Compass className="size-3.5" />
                Roll over allocations
              </Button>
            </div>
          )}
        </section>

        <StartCycleDialog
          open={startOpen}
          onOpenChange={setStartOpen}
          initialValues={startPrefill}
          onStart={startCycle}
        />
        {lastCompleted && (
          <CycleReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            cycleId={lastCompleted.cycle.id}
            onRollover={(prefill) => {
              setReviewOpen(false)
              handleStartWithPrefill(prefill)
            }}
          />
        )}
      </>
    )
  }

  const {
    currency,
    allowanceMinor,
    spentTodayMinor,
    remainingTodayMinor,
    daysRemainingInclusive,
    wantFundMinor,
    nearestQueueItem,
    cycle,
    grossMinor,
    allocations
  } = snapshot

  const overspent = remainingTodayMinor < 0
  const spendPct = allowanceMinor > 0 ? Math.min(100, Math.round((spentTodayMinor / allowanceMinor) * 100)) : 0

  return (
    <>
      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Compass className="size-4 text-primary" />
            <span>Today&apos;s Spending Pace</span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {daysRemainingInclusive}d left in cycle
          </span>
        </div>

        {/* Primary Number: Safe to spend today */}
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            {overspent ? "Overspent today by" : "Remaining for today"}
          </p>
          <p
            className={cn(
              "tabular mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl",
              overspent ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}
          >
            {formatMoney(Math.abs(remainingTodayMinor), currency)}
          </p>
        </div>

        {/* Micro-pacing summary & Progress bar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Spent <strong className="tabular text-foreground">{formatMoney(spentTodayMinor, currency)}</strong> of{" "}
              <span className="tabular">{formatMoney(allowanceMinor, currency)}</span>
            </span>
            <span className="tabular font-medium">{spendPct}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300",
                overspent ? "bg-rose-500" : spendPct > 80 ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${overspent ? 100 : spendPct}%` }}
            />
          </div>
        </div>

        {/* Funds Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            onClick={() => setQueueOpen(true)}
            className="group cursor-pointer rounded-2xl bg-muted/50 p-3.5 transition-colors hover:bg-muted/80"
          >
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="font-semibold text-foreground">Want Fund</span>
              <Gift className="size-3.5 text-purple-500" />
            </div>
            <div className="tabular mt-1 text-lg font-bold text-foreground">
              {formatMoney(wantFundMinor, currency)}
            </div>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
              Daily underspend saved for wishlist rewards
            </p>
          </div>

          <div
            className="group relative rounded-2xl bg-muted/50 p-3.5 transition-colors hover:bg-muted/80"
          >
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="font-semibold text-foreground">Accumulated Savings</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDepositOpen(true)
                  }}
                  className="flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-500/25 dark:text-emerald-400"
                >
                  <Plus className="size-3" /> Deposit
                </button>
                <TrendingUp className="size-3.5 text-emerald-500" />
              </div>
            </div>
            <div
              onClick={() => setDepositOpen(true)}
              className="tabular mt-1 cursor-pointer text-lg font-bold text-foreground transition-opacity hover:opacity-80"
            >
              {formatMoney(
                (snapshot as { accumulatedSavingsMinor?: number })?.accumulatedSavingsMinor ??
                  (allocations ?? [])
                    .filter((a) => a.kind === "savings")
                    .reduce((sum, a) => sum + a.amountMinor, 0),
                currency
              )}
            </div>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
              Protected savings & direct deposits
            </p>
          </div>
        </div>

        {/* Nearest Wishlist Item Banner */}
        {nearestQueueItem && (
          <div
            onClick={() => setQueueOpen(true)}
            className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs transition-colors hover:bg-purple-500/10 dark:bg-purple-950/20"
          >
            <span className="truncate font-medium text-foreground">
              Next priority: <strong className="font-semibold">{nearestQueueItem.title}</strong>
            </span>
            <span className="tabular shrink-0 font-semibold text-purple-600 dark:text-purple-400">
              {nearestQueueItem.daysToAfford === null
                ? "Not yet affordable"
                : nearestQueueItem.daysToAfford === 0
                  ? "Affordable now"
                  : `~${nearestQueueItem.daysToAfford}d away`}
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setQueueOpen(true)}>
            <ListTodo className="size-4" /> View Priority Wishlist
          </Button>
          <Button
            variant="ghost"
            className="gap-1.5 text-xs font-semibold text-primary"
            onClick={() => setEditAllocOpen(true)}
          >
            <Sliders className="size-3.5" /> Edit Fixed Allocations
          </Button>
        </div>
      </section>

      <QueueDialog open={queueOpen} onOpenChange={setQueueOpen} currency={currency} />
      <DepositSavingsDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        currency={currency}
        onDeposit={depositSavings}
      />
      <StartCycleDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        initialValues={startPrefill}
        onStart={startCycle}
      />
      {cycle && (
        <EditAllocationsDialog
          open={editAllocOpen}
          onOpenChange={setEditAllocOpen}
          cycleId={cycle.id}
          currency={currency}
          initialGross={grossMinor ? grossMinor / 100 : 0}
          initialSweepPct={cycle.sweepPct ?? 50}
          initialAllocations={allocations ?? []}
          onSave={updateCycle}
        />
      )}
    </>
  )
}

export default TodayCard
