import { t, protectedProcedure } from "../trpc"

export const insightsRouter = t.router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    return ctx.services.ledger.getSummary(ctx.chatId)
  })
})
