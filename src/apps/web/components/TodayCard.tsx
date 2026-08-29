import { useState } from "react"
import {
  CalendarClock,
  CheckCircle2,
  Compass,
  Gift,
  Plus,
  Sliders,
  TrendingUp,
  ArrowRight
} from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import { Button } from "@web/components/ui/button"
import StartCycleDialog from "./StartCycleDialog"
import EditAllocationsDialog from "./EditAllocationsDialog"
import QueueDialog from "./QueueDialog"
import CycleReviewDialog from "./CycleReviewDialog"
import type { AllocationKind } from "@/shared/types"
import DepositSavingsDialog from "./DepositSavingsDialog"

type Props = {
  onNavigate?: (view: "dashboard" | "transactions" | "wishlist" | "settings") => void
}

// The core Pacer dashboard metrics: displays today's remaining allowance,
// accumulated savings, want fund, and nearest wishlist item with generous breathing room.
const TodayCard = ({ onNavigate }: Props) => {
  const { snapshot, lastCompleted, isLoading, startCycle, updateCycle, depositSavings } = usePacer()
  const [startOpen, setStartOpen] = useState(false)
  const [editAllocOpen, setEditAllocOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [quickSalary, setQuickSalary] = useState("")
  const [startPrefill, setStartPrefill] = useState<{
    startDate?: string
    endDate?: string
    gross?: number
    sweepPct?: number
    allocations?: { kind: AllocationKind; label: string; amount: number }[]
  } | null>(null)

  const handleOpenWishlist = () => {
    if (onNavigate) {
      onNavigate("wishlist")
    } else {
      setQueueOpen(true)
    }
  }

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

  const handleQuickStart = () => {
    const salary = Number(quickSalary)
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    // Default to last day of current calendar month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const endIso = endOfMonth.toISOString().slice(0, 10)

    handleStartWithPrefill({
      startDate: today,
      endDate: endIso,
      gross: Number.isFinite(salary) && salary > 0 ? salary : 0,
      sweepPct: 50,
      allocations: []
    })
  }

  if (isLoading) {
    return <div className="h-40 w-full animate-pulse rounded-3xl border bg-card/60" />
  }

  // Not in a cycle: spacious setup state
  if (!snapshot || !snapshot.active) {
    return (
      <>
        <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Compass className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Start your monthly spending pace
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Pacer calculates your daily allowance from your salary after fixed commitments.
                </p>
              </div>
            </div>

            <Button
              onClick={() => handleStartWithPrefill()}
              className="gap-1.5 rounded-2xl px-5 text-sm font-semibold"
            >
              <Compass className="size-4" /> Start cycle
            </Button>
          </div>

          <div className="mt-6 rounded-2xl border bg-muted/20 p-4 sm:p-5">
            <label className="text-xs font-semibold text-muted-foreground">
              Quick start with monthly income
            </label>
            <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Monthly salary / income (e.g. 50000)"
                value={quickSalary}
                onChange={(e) => setQuickSalary(e.target.value)}
                className="tabular h-12 flex-1 rounded-2xl border bg-background px-4 text-base font-semibold text-foreground focus:border-primary focus:outline-none"
              />
              <Button
                onClick={handleQuickStart}
                className="h-12 gap-1.5 rounded-2xl px-6 text-sm font-bold"
              >
                <Compass className="size-4" />
                Start pacing
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[30000, 50000, 75000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuickSalary(String(amt))}
                    className="rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                    sweepPct: 50,
                    allocations: []
                  })
                }
                className="flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                <Sliders className="size-3.5" /> Customize fixed commitments (Rent, Savings)
              </button>
            </div>
          </div>

          {lastCompleted && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setReviewOpen(true)}
                className="gap-1.5 rounded-xl text-xs font-semibold"
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
                variant="secondary"
                className="rounded-xl text-xs font-semibold"
              >
                Rollover previous cycle allocations
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
  const spendPct =
    allowanceMinor > 0 ? Math.min(100, Math.round((spentTodayMinor / allowanceMinor) * 100)) : 0

  const totalAccumulatedSavings =
    (snapshot as { accumulatedSavingsMinor?: number })?.accumulatedSavingsMinor ??
    (allocations ?? []).filter((a) => a.kind === "savings").reduce((sum, a) => sum + a.amountMinor, 0)

  return (
    <div className="space-y-4">
      {/* 3-Box Overview Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Box 1: Today's Safe Spending Pace */}
        <div className="flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-sm sm:p-6 transition-all hover:border-border/80">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onNavigate?.("pacer")}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <Compass className="size-4 text-primary" />
                <span className="font-semibold text-foreground">Today&apos;s spending pace</span>
              </button>
              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <CalendarClock className="size-3" />
                {daysRemainingInclusive}d left
              </span>
            </div>

            <div className="mt-3 cursor-pointer" onClick={() => onNavigate?.("pacer")}>
              <p className="text-xs font-medium text-muted-foreground">
                {overspent ? "Overspent today by" : "Remaining for today"}
              </p>
              <p
                className={cn(
                  "tabular mt-1 text-2xl font-extrabold tracking-tight truncate sm:text-3xl xl:text-4xl",
                  overspent ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                )}
              >
                {formatMoney(Math.abs(remainingTodayMinor), currency)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 cursor-pointer" onClick={() => onNavigate?.("pacer")}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">
                Spent <strong className="tabular text-foreground">{formatMoney(spentTodayMinor, currency)}</strong> of{" "}
                <span className="tabular">{formatMoney(allowanceMinor, currency)}</span>
              </span>
              <span className="tabular font-semibold shrink-0">{spendPct}%</span>
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-1 border-t pt-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => onNavigate?.("pacer")}
              className="hover:text-foreground"
            >
              Daily pace →
            </button>
            <button
              type="button"
              onClick={() => setEditAllocOpen(true)}
              className="font-semibold text-primary hover:underline"
            >
              Edit allocations
            </button>
          </div>
        </div>

        {/* Box 2: Accumulated Savings Vault */}
        <div className="flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-sm sm:p-6 transition-all hover:border-border/80">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onNavigate?.("savings")}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <TrendingUp className="size-4 text-emerald-500" />
                <span className="font-semibold text-foreground">Accumulated savings</span>
              </button>
              <button
                type="button"
                onClick={() => setDepositOpen(true)}
                className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <Plus className="size-3" /> Deposit
              </button>
            </div>

            <div className="mt-3 cursor-pointer" onClick={() => onNavigate?.("savings")}>
              <p className="text-xs font-medium text-muted-foreground">Total protected savings</p>
              <p
                className="tabular mt-1 text-2xl font-extrabold tracking-tight text-foreground truncate transition-opacity hover:opacity-80 sm:text-3xl xl:text-4xl"
              >
                {formatMoney(totalAccumulatedSavings, currency)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-1 border-t pt-3 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => onNavigate?.("savings")}
              className="hover:text-foreground"
            >
              Savings vault page →
            </button>
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              + Quick deposit
            </button>
          </div>
        </div>

        {/* Box 3: Wishlist Want Fund */}
        <div className="flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-sm sm:p-6 transition-all hover:border-border/80 md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={handleOpenWishlist}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <Gift className="size-4 text-purple-500" />
                <span className="font-semibold text-foreground">Wishlist fund</span>
              </button>
              <button
                type="button"
                onClick={handleOpenWishlist}
                className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:underline dark:text-purple-400"
              >
                Wishlist <ArrowRight className="size-3" />
              </button>
            </div>

            <div className="mt-3 cursor-pointer" onClick={handleOpenWishlist}>
              <p className="text-xs font-medium text-muted-foreground">Daily underspend sweeps</p>
              <p
                className="tabular mt-1 text-2xl font-extrabold tracking-tight text-foreground truncate transition-opacity hover:opacity-80 sm:text-3xl xl:text-4xl"
              >
                {formatMoney(wantFundMinor, currency)}
              </p>
            </div>
          </div>

          <div className="mt-4 border-t pt-3">
            {nearestQueueItem ? (
              <div
                onClick={handleOpenWishlist}
                className="flex cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">
                  Next: <strong className="text-foreground">{nearestQueueItem.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
                </span>
                <span className="shrink-0 font-bold text-purple-600 dark:text-purple-400">
                  {nearestQueueItem.daysToAfford === null || nearestQueueItem.daysToAfford === undefined
                    ? "In queue"
                    : nearestQueueItem.daysToAfford === 0
                      ? "Affordable now"
                      : `~${nearestQueueItem.daysToAfford}d away`}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                <span>Daily sweeps reward wishlist</span>
                <button
                  type="button"
                  onClick={handleOpenWishlist}
                  className="font-semibold text-purple-600 hover:underline dark:text-purple-400"
                >
                  View wishlist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
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
          initialEndDate={cycle.endAt ? new Date(cycle.endAt).toISOString().slice(0, 10) : undefined}
          initialSweepPct={cycle.sweepPct ?? 50}
          initialAllocations={allocations ?? []}
          onSave={updateCycle}
        />
      )}
    </div>
  )
}

export default TodayCard
