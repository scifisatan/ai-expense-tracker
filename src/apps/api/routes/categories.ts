import { t, protectedProcedure } from "../trpc"
import { TRPCError } from "@trpc/server"
import {
  categoryCreateInputSchema,
  categoryUpdateInputSchema,
  categoryDeleteInputSchema,
} from "@/shared/types"

export const categoriesRouter = t.router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.repos.categories.listByAccount(ctx.accountId)
    return { items }
  }),

  create: protectedProcedure
    .input(categoryCreateInputSchema)
    .mutation(async ({ input, ctx }) => {
      const [created] = await ctx.repos.categories.create(ctx.accountId, input)
      return { category: created }
    }),

  update: protectedProcedure
    .input(categoryUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      const current = await ctx.repos.categories.findById(ctx.accountId, input.id)
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" })
      }

      await ctx.repos.categories.update(ctx.accountId, input.id, {
        name: input.name,
        type: input.type,
        color: input.color,
      })
      return { ok: true }
    }),

  delete: protectedProcedure
    .input(categoryDeleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.categories.remove(ctx.accountId, input.id)
      return { ok: true }
    }),
})
