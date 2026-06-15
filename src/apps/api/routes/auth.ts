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

  // The session cookie is cleared client-side; this exists for symmetry/future server-side revocation.
  logout: protectedProcedure.mutation(() => ({ ok: true })),
})
