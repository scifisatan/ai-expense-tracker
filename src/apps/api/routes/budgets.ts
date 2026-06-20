import { TRPCError } from "@trpc/server"
import { t, protectedProcedure } from "../trpc"
import {
  budgetCreateInputSchema,
  budgetDeleteInputSchema,
  budgetUpdateInputSchema
} from "@/shared/types"
import { toMinor } from "@/shared/money"

export const budgetsRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.repos.budgets.listByAccount(ctx.accountId)
    return { items }
  }),

  create: protectedProcedure.input(budgetCreateInputSchema).mutation(async ({ input, ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId)
    const currency = account?.defaultCurrency ?? "USD"

    const [created] = await ctx.repos.budgets.create(ctx.accountId, {
      categoryId: input.categoryId ?? null,
      amountMinor: toMinor(input.amount, currency),
      currency
    })

    return { ok: true, budget: created }
  }),

  update: protectedProcedure.input(budgetUpdateInputSchema).mutation(async ({ input, ctx }) => {
    const current = await ctx.repos.budgets.findById(ctx.accountId, input.id)
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found" })
    }

    await ctx.repos.budgets.update(ctx.accountId, input.id, {
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
      amountMinor:
        input.amount !== undefined ? toMinor(input.amount, current.currency) : current.amountMinor
    })

    return { ok: true }
  }),

  remove: protectedProcedure.input(budgetDeleteInputSchema).mutation(async ({ input, ctx }) => {
    await ctx.repos.budgets.remove(ctx.accountId, input.id)
    return { ok: true }
  })
})
