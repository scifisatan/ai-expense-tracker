import { z } from "zod"
import { t, protectedProcedure } from "../trpc"

export const settingsRouter = t.router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)

    return {
      defaultCurrency: account?.defaultCurrency ?? "USD",
      email: account?.email ?? null,
    }
  }),

  setDefaultCurrency: protectedProcedure
    .input(z.object({ currency: z.string().min(3).max(3) }))
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.currency.toUpperCase())
      return { ok: true }
    }),
})
