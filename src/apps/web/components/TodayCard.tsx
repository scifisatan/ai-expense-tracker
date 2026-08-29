import { useState } from "react"
import { CalendarClock, ListTodo, Sparkles } from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"
import { Button } from "@web/components/ui/button"
import { Skeleton } from "@web/components/ui/skeleton"
import StartCycleDialog from "./StartCycleDialog"
import QueueDialog from "./QueueDialog"

// The core Pacer loop, always visible: today's allowance, what's left of it,
// the two funds, and the nearest thing you're saving toward. Never renders
// nothing — unlike an optional widget, pacing is the point of the app.
const TodayCard = () => {
  const { snapshot, isLoading, startCycle } = usePacer()
  const [startOpen, setStartOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

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
          <div className="flex items-center gap-2 pb-1">
            <Sparkles className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pacing</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Start a cycle to see today's number — how much you can spend today without borrowing
            from tomorrow.
          </p>
          <Button className="mt-3" onClick={() => setStartOpen(true)}>
            Start your pacing cycle
          </Button>
        </section>
        <StartCycleDialog open={startOpen} onOpenChange={setStartOpen} onStart={startCycle} />
      </>
    )
  }

  const {
    currency,
    allowanceMinor,
    remainingTodayMinor,
    daysRemainingInclusive,
    wantFundMinor,
    needsReserveMinor,
    nearestQueueItem
  } = snapshot
  const overspent = remainingTodayMinor < 0

  return (
    <>
      <section className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Today's number</h2>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {daysRemainingInclusive} day{daysRemainingInclusive === 1 ? "" : "s"} left
          </span>
        </div>

        <div className="tabular text-4xl font-semibold tracking-tight text-foreground">
          {formatMoney(allowanceMinor, currency)}
        </div>
        <p className={cn("mt-1 text-sm", overspent ? "text-expense" : "text-muted-foreground")}>
          {overspent
            ? `${formatMoney(Math.abs(remainingTodayMinor), currency)} over today's allowance`
            : `${formatMoney(remainingTodayMinor, currency)} left today`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/50 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">Want Fund</div>
            <div className="tabular mt-1 text-lg font-semibold text-foreground">
              {formatMoney(wantFundMinor, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">Needs reserve</div>
            <div className="tabular mt-1 text-lg font-semibold text-foreground">
              {formatMoney(needsReserveMinor, currency)}
            </div>
          </div>
        </div>

        {nearestQueueItem && (
          <p className="mt-3 truncate text-xs text-muted-foreground">
            Next up: {nearestQueueItem.title} —{" "}
            {nearestQueueItem.daysToAfford === null
              ? "not affordable at the current pace"
              : nearestQueueItem.daysToAfford === 0
                ? "affordable now"
                : `~${nearestQueueItem.daysToAfford} day${nearestQueueItem.daysToAfford === 1 ? "" : "s"} away`}
          </p>
        )}

        <Button variant="outline" className="mt-4 w-full" onClick={() => setQueueOpen(true)}>
          <ListTodo className="size-4" /> View queue
        </Button>
      </section>

      <QueueDialog open={queueOpen} onOpenChange={setQueueOpen} currency={currency} />
    </>
  )
}

export default TodayCard
