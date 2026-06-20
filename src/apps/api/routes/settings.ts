import { z } from "zod"
import { t, protectedProcedure } from "../trpc"
import { settingsUpdateInputSchema } from "@/shared/types"

// Best-effort IANA timezone validation; falls back to accepting the string when
// the runtime lacks the timezone (date math degrades to UTC in that case).
const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const settingsRouter = t.router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)

    return {
      defaultCurrency: account?.defaultCurrency ?? "USD",
      timezone: account?.timezone ?? "UTC",
      email: account?.email ?? null,
    }
  }),

  setDefaultCurrency: protectedProcedure
    .input(z.object({ currency: z.string().min(3).max(3) }))
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.currency.toUpperCase())
      return { ok: true }
    }),

  update: protectedProcedure
    .input(settingsUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.defaultCurrency) {
        await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.defaultCurrency.toUpperCase())
      }
      if (input.timezone) {
        if (!isValidTimezone(input.timezone)) {
          throw new Error("INVALID_TIMEZONE")
        }
        await ctx.repos.accounts.setTimezone(ctx.accountId, input.timezone)
      }
      return { ok: true }
    }),
})
