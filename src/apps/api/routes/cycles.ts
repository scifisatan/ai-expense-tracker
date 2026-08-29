import { TRPCError } from "@trpc/server"
import { t, protectedProcedure } from "../trpc"
import { cycleCreateInputSchema, cycleCloseInputSchema, cycleReviewInputSchema } from "@/shared/types"
import { toMinor } from "@/shared/money"
import { startOfLocalDay, addDays, localDateString, parseDbTimestamp, toDbTimestamp, daysBetweenLocalDates } from "@/shared/datetime"
import { daysToAfford, poolMinor } from "@/shared/allowance"
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

  lastCompleted: protectedProcedure.query(async ({ ctx }) => {
    const nowTs = toDbTimestamp(new Date())
    const cycle = await ctx.repos.cycles.findLastCompleted(ctx.accountId, nowTs)
    if (!cycle) return null

    const allocations = await ctx.repos.cycles.listAllocations(cycle.id)
    return {
      cycle,
      allocations,
      currency: cycle.currency
    }
  }),

  review: protectedProcedure.input(cycleReviewInputSchema.optional()).query(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const nowTs = toDbTimestamp(new Date())

    const cycle = input?.id
      ? await ctx.repos.cycles.findById(ctx.accountId, input.id)
      : await ctx.repos.cycles.findLastCompleted(ctx.accountId, nowTs)

    if (!cycle) return null

    const allocations = await ctx.repos.cycles.listAllocations(cycle.id)
    const pool = poolMinor(
      cycle.grossMinor,
      allocations.map((a) => a.amountMinor)
    )

    // Total expenses incurred in this cycle's range [startAt, endAt)
    const totalSpentMinor = await ctx.repos.transactions.getCategoryExpenseInRange(
      ctx.accountId,
      null,
      cycle.startAt,
      cycle.endAt
    )

    // Sum day closes for this cycle
    const { spentMinor: _totalClosedSpent, sweptMinor: totalSweptMinor } =
      await ctx.repos.pacer.sumForCycleBefore(cycle.id, "9999-12-31")

    const wantFundBalanceMinor = await ctx.repos.pacer.balance(ctx.accountId, "want_fund")
    const needsReserveBalanceMinor = await ctx.repos.pacer.balance(ctx.accountId, "needs_reserve")

    const startLocalDate = localDateString(timezone, parseDbTimestamp(cycle.startAt))
    const endLocalDate = addDays(timezone, localDateString(timezone, parseDbTimestamp(cycle.endAt)), -1)
    const totalDays = Math.max(
      1,
      daysBetweenLocalDates(startLocalDate, localDateString(timezone, parseDbTimestamp(cycle.endAt)))
    )

    return {
      cycle,
      allocations,
      currency: cycle.currency,
      poolMinor: pool,
      totalSpentMinor,
      totalSweptMinor,
      totalDays,
      startLocalDate,
      endLocalDate,
      wantFundBalanceMinor,
      needsReserveBalanceMinor
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
