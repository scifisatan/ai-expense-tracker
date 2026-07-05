import { z } from "zod"
import { TRPCError } from "@trpc/server"
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

// The bot's @username, read from the cached getMe payload in the BOT_INFO KV.
// Lets the web link users straight to the bot (t.me/<username>).
const getBotUsername = async (kv: KVNamespace): Promise<string | null> => {
  try {
    const raw = await kv.get("BOT_INFO")
    if (!raw) return null
    const info = JSON.parse(raw) as { username?: string }
    return info.username ?? null
  } catch {
    return null
  }
}

export const settingsRouter = t.router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const txCount = await ctx.repos.transactions.countByAccount(ctx.accountId)
    const botUsername = await getBotUsername(ctx.env.BOT_INFO)

    return {
      defaultCurrency: account?.defaultCurrency ?? "USD",
      timezone: account?.timezone ?? "UTC",
      email: account?.email ?? null,
      onboarded: account?.onboardedAt != null,
      // Currency is single-per-account with no FX, so it locks once any transaction
      // exists — otherwise the balance would mix currencies incoherently.
      currencyLocked: txCount > 0,
      botUsername,
    }
  }),

  // First-run onboarding. The account is necessarily empty here, so currency is
  // free to set; afterwards it follows the same transaction-count lock as everyone.
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        currency: z.string().min(3).max(3),
        timezone: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const account = await ctx.repos.accounts.findById(ctx.accountId)
      if (account?.onboardedAt != null) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Onboarding already completed." })
      }
      if (!isValidTimezone(input.timezone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_TIMEZONE" })
      }
      await ctx.repos.accounts.completeOnboarding(ctx.accountId, {
        currency: input.currency.toUpperCase(),
        timezone: input.timezone,
      })
      return { ok: true }
    }),

  setDefaultCurrency: protectedProcedure
    .input(z.object({ currency: z.string().min(3).max(3) }))
    .mutation(async ({ input, ctx }) => {
      const txCount = await ctx.repos.transactions.countByAccount(ctx.accountId)
      if (txCount > 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Currency is locked once you have transactions.",
        })
      }
      await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.currency.toUpperCase())
      return { ok: true }
    }),

  update: protectedProcedure
    .input(settingsUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.defaultCurrency) {
        const txCount = await ctx.repos.transactions.countByAccount(ctx.accountId)
        if (txCount > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Currency is locked once you have transactions.",
          })
        }
        await ctx.repos.accounts.setDefaultCurrency(ctx.accountId, input.defaultCurrency.toUpperCase())
      }
      if (input.timezone) {
        if (!isValidTimezone(input.timezone)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_TIMEZONE" })
        }
        await ctx.repos.accounts.setTimezone(ctx.accountId, input.timezone)
      }
      return { ok: true }
    }),
})
