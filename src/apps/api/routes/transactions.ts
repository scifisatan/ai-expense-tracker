import { TRPCError } from "@trpc/server"
import { t, protectedProcedure } from "../trpc"
import {
  transactionsDeleteInputSchema,
  transactionsListInputSchema,
  transactionsUpdateInputSchema
} from "@/shared/types"

const throwLedgerMutationError = (error: unknown): never => {
  if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" })
  }

  throw error
}

export const transactionsRouter = t.router({
  list: protectedProcedure.input(transactionsListInputSchema).query(async ({ input, ctx }) => {
    const items = await ctx.services.ledger.listRecent(ctx.chatId, input.limit)
    return { items }
  }),
  update: protectedProcedure
    .input(transactionsUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ctx.services.ledger.updateTransaction(ctx.chatId, input.id, {
          amount: input.amount,
          type: input.type,
          note: input.note
        })

        return { ok: true, newBalance: result.newBalance }
      } catch (error) {
        return throwLedgerMutationError(error)
      }
    }),
  delete: protectedProcedure
    .input(transactionsDeleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.services.ledger.deleteTransactions(ctx.chatId, input.ids)
      return { ok: true, newBalance: result.newBalance }
    })
})
