import type { ApiContext } from "@api/trpc"
import { poolMinor, allowanceForDay, sweepMinor } from "@/shared/allowance"
import { localDateString, dayRange, daysBetweenLocalDates, parseDbTimestamp, toDbTimestamp } from "@/shared/datetime"
import type { Cycle } from "@/db/schema"

type PacerCtx = Pick<ApiContext, "repos"> & { accountId: string }

export type CycleSnapshot =
  | { active: false }
  | {
      active: true
      cycle: Cycle
      poolMinor: number
      allowanceMinor: number
      spentTodayMinor: number
      daysRemainingInclusive: number
      projectedDailySweepMinor: number
      wantFundMinor: number
      needsReserveMinor: number
    }

// The core "where do things stand right now" computation, reused identically
// by cyclesRouter.current (web + bot /today) and queueRouter.list (to project
// affordability). Mirrors allowanceForDay's contract in shared/allowance.ts.
export const computeCycleSnapshot = async (
  ctx: PacerCtx,
  timezone: string,
  now: Date = new Date()
): Promise<CycleSnapshot> => {
  const nowTs = toDbTimestamp(now)
  const cycle = await ctx.repos.cycles.findOpenForDate(ctx.accountId, nowTs)
  if (!cycle) return { active: false }

  const today = localDateString(timezone, now)
  const allocations = await ctx.repos.cycles.listAllocations(cycle.id)
  const pool = poolMinor(
    cycle.grossMinor,
    allocations.map((a) => a.amountMinor)
  )

  const { spentMinor: spentBeforeToday, sweptMinor: sweptBeforeToday } =
    await ctx.repos.pacer.sumForCycleBefore(cycle.id, today)

  const todayRange = dayRange(timezone, now)
  const spentTodayMinor = await ctx.repos.transactions.getDiscretionaryExpenseInRange(
    ctx.accountId,
    todayRange.from,
    todayRange.to
  )

  // cycle.endAt is the exclusive DB timestamp for the day after the cycle's
  // last day, so its local date IS the count of remaining inclusive days.
  const cycleEndLocalDate = localDateString(timezone, parseDbTimestamp(cycle.endAt))
  const daysRemainingInclusive = daysBetweenLocalDates(today, cycleEndLocalDate)

  const allowanceMinor = allowanceForDay({
    poolMinor: pool,
    spentBeforeTodayMinor: spentBeforeToday,
    sweptBeforeTodayMinor: sweptBeforeToday,
    daysRemainingInclusive
  })
  const projectedDailySweepMinor = sweepMinor({
    allowanceMinor,
    spentTodayMinor,
    sweepPct: cycle.sweepPct
  })

  const [wantFundMinor, needsReserveMinor] = await Promise.all([
    ctx.repos.pacer.balance(ctx.accountId, "want_fund"),
    ctx.repos.pacer.balance(ctx.accountId, "needs_reserve")
  ])

  return {
    active: true,
    cycle,
    poolMinor: pool,
    allowanceMinor,
    spentTodayMinor,
    daysRemainingInclusive,
    projectedDailySweepMinor,
    wantFundMinor,
    needsReserveMinor
  }
}
