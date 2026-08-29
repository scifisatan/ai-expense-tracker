import { CheckCircle2, Compass, TrendingUp, Wallet, ArrowRight, ShieldCheck, HeartHandshake, Gift } from "lucide-react"
import { usePacer } from "@web/hooks/usePacer"
import { trpc } from "@web/trpc"
import { formatMoney } from "@web/helper"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Skeleton } from "@web/components/ui/skeleton"
import type { AllocationKind } from "@/shared/types"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartNextCycle: (prefill: {
    startDate: string
    gross: number
    sweepPct: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => void
}

// Comprehensive cycle performance review modal.
// Displays discretionary pool, actual spent, swept surplus into Want Fund, and rollover pre-fill.
const CycleReviewDialog = ({ open, onOpenChange, onStartNextCycle }: Props) => {
  const { lastCompleted } = usePacer()
  const cycleId = lastCompleted?.cycle.id

  const { data: review, isLoading } = trpc.cycles.review.useQuery(
    { id: cycleId! },
    { enabled: open && typeof cycleId === "number" }
  )

  const handleRollover = () => {
    if (!review) return
    const nextStart = new Date(review.endLocalDate)
    nextStart.setDate(nextStart.getDate() + 1)
    const nextStartStr = nextStart.toISOString().slice(0, 10)

    if (lastCompleted) {
      onStartNextCycle({
        startDate: nextStartStr,
        gross: lastCompleted.cycle.grossMinor / 100,
        sweepPct: lastCompleted.cycle.sweepPct,
        allocations: lastCompleted.allocations.map((a) => ({
          kind: a.kind as AllocationKind,
          label: a.label,
          amount: a.amountMinor / 100
        }))
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Compass className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Cycle Summary</span>
          </div>
          <DialogTitle className="text-xl font-bold">Pacing Review</DialogTitle>
          <DialogDescription>
            {review
              ? `${review.startLocalDate} to ${review.endLocalDate} (${review.totalDays} days)`
              : "Reviewing your cycle performance"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !review ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Top Highlights Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-muted/40 p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="size-3.5" />
                  <span>Discretionary Pool</span>
                </div>
                <div className="tabular mt-1 text-lg font-bold text-foreground">
                  {formatMoney(review.poolMinor, review.currency)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Spent: {formatMoney(review.totalSpentMinor, review.currency)}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  <span>Want Fund Swept</span>
                </div>
                <div className="tabular mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatMoney(review.totalSweptMinor, review.currency)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Total saved for wishes
                </div>
              </div>
            </div>

            {/* Balances Status */}
            <div className="rounded-2xl border bg-card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fund Balances After Cycle
              </h4>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Gift className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Want Fund</p>
                    <p className="tabular text-sm font-semibold text-foreground">
                      {formatMoney(review.wantFundBalanceMinor, review.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Needs Reserve</p>
                    <p className="tabular text-sm font-semibold text-foreground">
                      {formatMoney(review.needsReserveBalanceMinor, review.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations breakdown */}
            {review.allocations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Off-The-Top Allocations ({formatMoney(review.cycle.grossMinor - review.poolMinor, review.currency)})
                </h4>
                <div className="max-h-36 divide-y divide-border/60 overflow-y-auto rounded-xl border bg-muted/20 px-3">
                  {review.allocations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span className="font-medium text-foreground">{a.label}</span>
                      </div>
                      <span className="tabular font-semibold text-muted-foreground">
                        {formatMoney(a.amountMinor, review.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rollover CTA */}
            {onStartNextCycle && (
              <Button onClick={handleRollover} className="w-full gap-2">
                <HeartHandshake className="size-4" />
                Roll over & Start Next Cycle
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default CycleReviewDialog
