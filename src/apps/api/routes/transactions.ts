import { TRPCError } from "@trpc/server";
import { t, protectedProcedure } from "../trpc";
import {
  transactionsCreateInputSchema,
  transactionsDeleteInputSchema,
  transactionsListInputSchema,
  transactionsUpdateInputSchema,
} from "@/shared/types";
import { publishBalance } from "@api/lib/ledger";
import { toMinor } from "@/shared/money";

const accountCurrency = async (ctx: { repos: { accounts: { findById: (id: string) => Promise<{ defaultCurrency: string } | undefined> } }; accountId: string }) => {
  const account = await ctx.repos.accounts.findById(ctx.accountId);
  return account?.defaultCurrency ?? "USD";
};

export const transactionsRouter = t.router({
  list: protectedProcedure
    .input(transactionsListInputSchema)
    .query(async ({ input, ctx }) => {
      const items = await ctx.repos.transactions.listRecent(
        ctx.accountId,
        input.limit,
      );
      return { items };
    }),

  create: protectedProcedure
    .input(transactionsCreateInputSchema)
    .mutation(async ({ input, ctx }) => {
      const currency = input.currency ?? (await accountCurrency(ctx));

      const [created] = await ctx.repos.transactions.insertOne(ctx.accountId, {
        amountMinor: toMinor(input.amount, currency),
        currency,
        type: input.type,
        categoryId: input.categoryId ?? null,
        note: input.note ?? null,
        occurredAt: input.occurredAt,
        source: "web",
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency);

      return { ok: true, transaction: created, newBalance };
    }),

  update: protectedProcedure
    .input(transactionsUpdateInputSchema)
    .mutation(async ({ input, ctx }) => {
      const current = await ctx.repos.transactions.findById(
        ctx.accountId,
        input.id,
      );

      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      const currency = input.currency ?? current.currency;

      await ctx.repos.transactions.updateById(ctx.accountId, input.id, {
        amountMinor:
          input.amount !== undefined
            ? Math.abs(toMinor(input.amount, currency))
            : current.amountMinor,
        currency,
        type: input.type ?? current.type,
        categoryId:
          input.categoryId !== undefined ? input.categoryId : current.categoryId,
        note: input.note !== undefined ? input.note : current.note,
        occurredAt: input.occurredAt ?? current.occurredAt,
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, await accountCurrency(ctx));

      return { ok: true, newBalance };
    }),

  delete: protectedProcedure
    .input(transactionsDeleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.ids.length === 0) {
        const balance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
        return { ok: true, newBalance: balance };
      }

      await ctx.repos.transactions.deleteByIds(ctx.accountId, input.ids);

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, await accountCurrency(ctx));

      return { ok: true, newBalance };
    }),
});
