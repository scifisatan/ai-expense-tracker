import { t, protectedProcedure } from "../trpc"
import { periodInputSchema } from "@/shared/types"
import { resolvePeriod } from "@/shared/datetime"

export const insightsRouter = t.router({
  summary: protectedProcedure.input(periodInputSchema).query(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const timezone = account?.timezone ?? "UTC"
    const range = resolvePeriod(input, timezone)
    const summary = await ctx.repos.transactions.getSummaryInRange(ctx.accountId, range.from, range.to)
    return {
      ...summary,
      currency: account?.defaultCurrency ?? "USD",
      period: input?.period ?? "month",
      from: range.from,
      to: range.to
    }
  })
})
