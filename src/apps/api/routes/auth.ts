import { t, publicProcedure, protectedProcedure } from "../trpc"

export const authRouter = t.router({
  session: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.accountId) {
      return { authenticated: false, accountId: null, email: null as string | null }
    }

    const account = await ctx.repos.accounts.findById(ctx.accountId)
    return {
      authenticated: true,
      accountId: ctx.accountId,
      email: account?.email ?? null,
    }
  }),

  // Bumps the account's tokenVersion, invalidating every outstanding session
  // token ("log out everywhere"). The HttpOnly cookie is cleared via /api/auth/logout.
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.repos.accounts.bumpTokenVersion(ctx.accountId)
    return { ok: true }
  }),
})
