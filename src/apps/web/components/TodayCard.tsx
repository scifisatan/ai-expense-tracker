import { useState } from "react"
import { CalendarClock, ListTodo, Sparkles, TrendingUp, PartyPopper, CheckCircle2 } from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import { Button } from "@web/components/ui/button"
import { Skeleton } from "@web/components/ui/skeleton"
import StartCycleDialog from "./StartCycleDialog"
import QueueDialog from "./QueueDialog"
import CycleReviewDialog from "./CycleReviewDialog"
import type { AllocationKind } from "@/shared/types"

// The core Pacer loop: today's allowance, visual spending pace progress,
// the two funds, and nearest wishlist item. Offers cycle completion review & rollover.
const TodayCard = () => {
  const { snapshot, lastCompleted, isLoading, startCycle } = usePacer()
  const [startOpen, setStartOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [startPrefill, setStartPrefill] = useState<{
    startDate?: string
    endDate?: string
    gross?: number
    sweepPct?: number
    allocations?: { kind: AllocationKind; label: string; amount: number }[]
  } | null>(null)

  const handleStartWithPrefill = (prefill?: {
    startDate: string
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
        <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 pb-1">
            {lastCompleted ? (
              <PartyPopper className="size-5 text-purple-500" />
            ) : (
              <Sparkles className="size-5 text-primary" />
            )}
            <h2 className="text-base font-bold">
              {lastCompleted ? "Cycle Completed! 🎉" : "Daily Pacing"}
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {lastCompleted
              ? "Your previous pacing cycle has ended. Review your results and roll over allocations to keep your financial pace."
              : "Start a cycle to see today's number — how much you can spend today without borrowing from tomorrow."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {lastCompleted && (
              <Button
                variant="outline"
                onClick={() => setReviewOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Review previous cycle
              </Button>
            )}
            <Button
              onClick={() => handleStartWithPrefill()}
              className="gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="size-3.5" />
              {lastCompleted ? "Start next cycle" : "Start your pacing cycle"}
            </Button>
          </div>
        </section>

        <StartCycleDialog
          open={startOpen}
          onOpenChange={setStartOpen}
          initialValues={startPrefill}
          onStart={startCycle}
        />

        <CycleReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onStartNextCycle={(prefill) => {
            setReviewOpen(false)
            handleStartWithPrefill(prefill)
          }}
        />
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
    needsReserveMinor,
    nearestQueueItem
  } = snapshot

  const overspent = remainingTodayMinor < 0
  const spendPct = allowanceMinor > 0 ? Math.min(100, Math.max(0, (spentTodayMinor / allowanceMinor) * 100)) : 0

  return (
    <>
      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Today's number</h2>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {daysRemainingInclusive} day{daysRemainingInclusive === 1 ? "" : "s"} left
          </span>
        </div>

        {/* Big Allowance Number */}
        <div className="tabular text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          {formatMoney(allowanceMinor, currency)}
        </div>

        <p className={cn("mt-1.5 text-sm font-medium", overspent ? "text-expense" : "text-muted-foreground")}>
          {overspent
            ? `${formatMoney(Math.abs(remainingTodayMinor), currency)} over today's allowance`
            : `${formatMoney(remainingTodayMinor, currency)} remaining today`}
        </p>

        {/* Visual Spending Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Spent today: {formatMoney(spentTodayMinor, currency)}</span>
            <span>{Math.round(spendPct)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                overspent
                  ? "bg-rose-500"
                  : spendPct > 80
                    ? "bg-amber-500"
                    : "bg-emerald-500"
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
              <span>Want Fund</span>
              <Sparkles className="size-3.5 text-purple-500" />
            </div>
            <div className="tabular mt-1 text-lg font-bold text-foreground">
              {formatMoney(wantFundMinor, currency)}
            </div>
          </div>

          <div
            onClick={() => setQueueOpen(true)}
            className="group cursor-pointer rounded-2xl bg-muted/50 p-3.5 transition-colors hover:bg-muted/80"
          >
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Needs Reserve</span>
              <TrendingUp className="size-3.5 text-blue-500" />
            </div>
            <div className="tabular mt-1 text-lg font-bold text-foreground">
              {formatMoney(needsReserveMinor, currency)}
            </div>
          </div>
        </div>

        {/* Nearest Wishlist Item Banner */}
        {nearestQueueItem && (
          <div
            onClick={() => setQueueOpen(true)}
            className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs transition-colors hover:bg-purple-500/10 dark:bg-purple-950/20"
          >
            <span className="truncate font-medium text-foreground">
              🎯 Next up: <strong className="font-semibold">{nearestQueueItem.title}</strong>
            </span>
            <span className="tabular shrink-0 font-semibold text-purple-600 dark:text-purple-400">
              {nearestQueueItem.daysToAfford === null
                ? "Not yet affordable"
                : nearestQueueItem.daysToAfford === 0
                  ? "Affordable now!"
                  : `~${nearestQueueItem.daysToAfford}d away`}
            </span>
          </div>
        )}

        <Button variant="outline" className="mt-4 w-full gap-1.5" onClick={() => setQueueOpen(true)}>
          <ListTodo className="size-4" /> View Needs & Wants Queue
        </Button>
      </section>

      <QueueDialog open={queueOpen} onOpenChange={setQueueOpen} currency={currency} />
      <StartCycleDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        initialValues={startPrefill}
        onStart={startCycle}
      />
    </>
  )
}

export default TodayCard
