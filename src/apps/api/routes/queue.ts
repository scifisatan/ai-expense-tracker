import { TRPCError } from "@trpc/server"
import { t, protectedProcedure } from "../trpc"
import {
  queueListInputSchema,
  queueCreateInputSchema,
  queueUpdateInputSchema,
  queueReorderInputSchema,
  queuePurchaseInputSchema,
  queueRemoveInputSchema
} from "@/shared/types"
import { toMinor } from "@/shared/money"
import { localDateString, addDays } from "@/shared/datetime"
import { midRank, needsRenormalize, calculateQueueAffordability } from "@/shared/allowance"
import { computeCycleSnapshot } from "../lib/pacer"
import type { FundBucket } from "../repositories/pacer"

// Wants default to a 3-day cooling-off period unless the caller overrides it.
const DEFAULT_COOLING_DAYS = 3

const bucketFor = (kind: "need" | "want"): FundBucket =>
  kind === "want" ? "want_fund" : "needs_reserve"

export const queueRouter = t.router({
  list: protectedProcedure.input(queueListInputSchema).query(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"

    const [items, snapshot] = await Promise.all([
      ctx.repos.queue.listByAccount(ctx.accountId, input.kind),
      computeCycleSnapshot(ctx, timezone)
    ])

    const currentBalanceMinor = snapshot.active
      ? input.kind === "want"
        ? snapshot.wantFundMinor
        : snapshot.needsReserveMinor
      : 0
    const projectedDailySweepMinor =
      snapshot.active && input.kind === "want" ? snapshot.projectedDailySweepMinor : 0

    const affordabilityMap = calculateQueueAffordability(
      items,
      currentBalanceMinor,
      projectedDailySweepMinor
    )

    return {
      currentBalanceMinor,
      projectedDailySweepMinor,
      items: items.map((item) => {
        const aff = affordabilityMap.get(item.id)
        return {
          ...item,
          daysToAfford: aff?.daysToAfford ?? null,
          cumulativePriceMinor: aff?.cumulativePriceMinor ?? item.priceMinor
        }
      })
    }
  }),

  create: protectedProcedure.input(queueCreateInputSchema).mutation(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const currency = account?.defaultCurrency ?? "USD"

    const lastRank = await ctx.repos.queue.lastRank(ctx.accountId, input.kind)
    const rank = midRank(lastRank, null)

    const coolingUntil =
      input.kind === "want"
        ? addDays(timezone, localDateString(timezone), input.coolingDays ?? DEFAULT_COOLING_DAYS)
        : null

    const item = await ctx.repos.queue.create(ctx.accountId, {
      kind: input.kind,
      title: input.title,
      priceMinor: toMinor(input.price, currency),
      currency,
      rank,
      coolingUntil,
      deadline: input.kind === "need" ? (input.deadline ?? null) : null
    })

    return { ok: true, item }
  }),

  update: protectedProcedure.input(queueUpdateInputSchema).mutation(async ({ input, ctx }) => {
    const current = await ctx.repos.queue.findById(ctx.accountId, input.id)
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Queue item not found" })
    }

    await ctx.repos.queue.update(ctx.accountId, input.id, {
      title: input.title,
      priceMinor: input.price !== undefined ? toMinor(input.price, current.currency) : undefined,
      deadline: input.deadline
    })

    return { ok: true }
  }),

  reorder: protectedProcedure.input(queueReorderInputSchema).mutation(async ({ input, ctx }) => {
    if (input.id === input.afterId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reorder an item after itself" })
    }

    const current = await ctx.repos.queue.findById(ctx.accountId, input.id)
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Queue item not found" })
    }

    const { prevRank, nextRank } = await ctx.repos.queue.neighbors(
      ctx.accountId,
      current.kind,
      input.afterId
    )
    await ctx.repos.queue.update(ctx.accountId, input.id, { rank: midRank(prevRank, nextRank) })

    if (needsRenormalize(prevRank, nextRank)) {
      await ctx.repos.queue.renormalize(ctx.accountId, current.kind)
    }

    return { ok: true }
  }),

  purchase: protectedProcedure.input(queuePurchaseInputSchema).mutation(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"

    const current = await ctx.repos.queue.findById(ctx.accountId, input.id)
    if (!current || current.status !== "queued") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Queue item not found" })
    }

    const today = localDateString(timezone)
    if (current.coolingUntil && current.coolingUntil > today) {
      throw new TRPCError({ code: "FORBIDDEN", message: "COOLING" })
    }

    const bucket = bucketFor(current.kind)
    const balance = await ctx.repos.pacer.balance(ctx.accountId, bucket)
    if (balance < current.priceMinor) {
      throw new TRPCError({ code: "FORBIDDEN", message: "UNDERFUNDED" })
    }

    await ctx.db.batch([
      ctx.repos.queue.markPurchased(ctx.accountId, input.id),
      ctx.repos.pacer.insertPurchaseDebit({
        accountId: ctx.accountId,
        bucket,
        priceMinor: current.priceMinor,
        queueItemId: input.id
      })
    ])

    return { ok: true }
  }),

  remove: protectedProcedure.input(queueRemoveInputSchema).mutation(async ({ input, ctx }) => {
    await ctx.repos.queue.remove(ctx.accountId, input.id)
    return { ok: true }
  })
})
