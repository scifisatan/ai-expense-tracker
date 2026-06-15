import { z } from "zod"
import { t, protectedProcedure } from "../trpc"

export const settingsRouter = t.router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const groqApiKey = await ctx.repos.settings.getGroqApiKey(ctx.accountId)
    const account = await ctx.repos.accounts.findById(ctx.accountId)

    return {
      hasKey: !!groqApiKey,
      defaultCurrency: account?.defaultCurrency ?? "USD",
      email: account?.email ?? null,
    }
  }),

  getGroqStatus: protectedProcedure.query(async ({ ctx }) => {
    const groqApiKey = await ctx.repos.settings.getGroqApiKey(ctx.accountId)
    return { hasKey: !!groqApiKey }
  }),

  setGroqKey: protectedProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.settings.setGroqApiKey(ctx.accountId, input.key)
      return { ok: true }
    }),

  removeGroqKey: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.repos.settings.setGroqApiKey(ctx.accountId, null)
    return { ok: true }
  }),

  setDefaultCurrency: protectedProcedure
    .input(z.object({ currency: z.string().min(3).max(3) }))
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.currency.toUpperCase())
      return { ok: true }
    }),
})
