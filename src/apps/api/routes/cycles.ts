import { TRPCError } from "@trpc/server"
import { t, protectedProcedure } from "../trpc"
import { cycleCreateInputSchema, cycleCloseInputSchema } from "@/shared/types"
import { toMinor } from "@/shared/money"
import { startOfLocalDay, addDays } from "@/shared/datetime"
import { daysToAfford } from "@/shared/allowance"
import { computeCycleSnapshot } from "../lib/pacer"

export const cyclesRouter = t.router({
  // The single aggregation point for "where do things stand right now" —
  // reused identically by the web dashboard's TodayCard and the bot's /today.
  current: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const currency = account?.defaultCurrency ?? "USD"

    const snapshot = await computeCycleSnapshot(ctx, timezone)
    if (!snapshot.active) return { active: false as const }

    const wantQueue = await ctx.repos.queue.listByAccount(ctx.accountId, "want")
    const nearest = wantQueue[0]
    const nearestQueueItem = nearest
      ? {
          id: nearest.id,
          title: nearest.title,
          priceMinor: nearest.priceMinor,
          daysToAfford: daysToAfford({
            priceMinor: nearest.priceMinor,
            currentBalanceMinor: snapshot.wantFundMinor,
            projectedDailySweepMinor: snapshot.projectedDailySweepMinor
          })
        }
      : null

    return {
      active: true as const,
      currency,
      cycle: {
        id: snapshot.cycle.id,
        startAt: snapshot.cycle.startAt,
        endAt: snapshot.cycle.endAt,
        sweepPct: snapshot.cycle.sweepPct
      },
      poolMinor: snapshot.poolMinor,
      allowanceMinor: snapshot.allowanceMinor,
      spentTodayMinor: snapshot.spentTodayMinor,
      remainingTodayMinor: snapshot.allowanceMinor - snapshot.spentTodayMinor,
      daysRemainingInclusive: snapshot.daysRemainingInclusive,
      wantFundMinor: snapshot.wantFundMinor,
      needsReserveMinor: snapshot.needsReserveMinor,
      nearestQueueItem
    }
  }),

  create: protectedProcedure.input(cycleCreateInputSchema).mutation(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const currency = account?.defaultCurrency ?? "USD"

    // endDate is inclusive from the user's perspective; the stored range is
    // half-open, so the boundary is local midnight of the day after.
    const startAt = startOfLocalDay(timezone, input.startDate)
    const endAt = startOfLocalDay(timezone, addDays(timezone, input.endDate, 1))

    const cycle = await ctx.repos.cycles.create(ctx.accountId, {
      startAt,
      endAt,
      grossMinor: toMinor(input.gross, currency),
      currency,
      sweepPct: input.sweepPct
    })

    await ctx.repos.cycles.addAllocations(
      cycle.id,
      input.allocations.map((allocation) => ({
        kind: allocation.kind,
        label: allocation.label,
        amountMinor: toMinor(allocation.amount, currency)
      }))
    )

    return { ok: true, cycle }
  }),

  close: protectedProcedure.input(cycleCloseInputSchema).mutation(async ({ input, ctx }) => {
    const cycle = await ctx.repos.cycles.findById(ctx.accountId, input.id)
    if (!cycle) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" })
    }

    await ctx.repos.cycles.close(ctx.accountId, input.id)
    return { ok: true }
  })
})
