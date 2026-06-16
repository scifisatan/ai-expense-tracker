import { t, protectedProcedure } from "../trpc"

export const insightsRouter = t.router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const summary = await ctx.repos.transactions.getSummary(ctx.accountId)
    return { ...summary, currency: account?.defaultCurrency ?? "USD" }
  })
})
