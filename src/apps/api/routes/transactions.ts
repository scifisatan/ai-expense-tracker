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
import { log } from "@/utils/logger";
import { normalizeBackdate, resolvePeriod } from "@/shared/datetime";

const accountCurrency = async (ctx: { repos: { accounts: { findById: (id: string) => Promise<{ defaultCurrency: string } | undefined> } }; accountId: string }) => {
  const account = await ctx.repos.accounts.findById(ctx.accountId);
  return account?.defaultCurrency ?? "USD";
};

// Client-supplied dates (bare "YYYY-MM-DD" from the web date picker) must be
// normalized to the DB's UTC "YYYY-MM-DD HH:MM:SS" shape, anchored in the
// account timezone, or range queries would misbucket them.
const normalizeOccurredAt = async (
  ctx: { repos: { accounts: { findById: (id: string) => Promise<{ timezone: string | null } | undefined> } }; accountId: string },
  occurredAt: string | undefined,
): Promise<string | undefined> => {
  if (!occurredAt) return undefined;
  const account = await ctx.repos.accounts.findById(ctx.accountId);
  return normalizeBackdate(occurredAt, account?.timezone ?? "UTC") ?? undefined;
};

export const transactionsRouter = t.router({
  list: protectedProcedure
    .input(transactionsListInputSchema)
    .query(async ({ input, ctx }) => {
      // Period-scoped listing (keyset paginated by occurredAt); otherwise the most
      // recent across all time.
      if (input.period) {
        const account = await ctx.repos.accounts.findById(ctx.accountId);
        const range = resolvePeriod(
          { period: input.period, from: input.from, to: input.to },
          account?.timezone ?? "UTC",
        );
        return ctx.repos.transactions.listInRange(
          ctx.accountId,
          range.from,
          range.to,
          input.limit,
          input.cursor,
        );
      }

      return ctx.repos.transactions.listRecent(ctx.accountId, input.limit, input.cursor);
    }),

  create: protectedProcedure
    .input(transactionsCreateInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Single-currency per account: ignore any per-transaction currency input and
      // store in the account default so the balance SUM stays coherent.
      const currency = await accountCurrency(ctx);

      const [created] = await ctx.repos.transactions.insertOne(ctx.accountId, {
        amountMinor: toMinor(input.amount, currency),
        currency,
        type: input.type,
        categoryId: input.categoryId ?? null,
        note: input.note ?? null,
        occurredAt: await normalizeOccurredAt(ctx, input.occurredAt),
        source: "web",
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      ctx.waitUntil(
        publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency)
          .catch((error) => log.api.error("publish-balance", error)),
      );

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

      // Pin to the account default currency; ignore any currency override.
      const currency = await accountCurrency(ctx);

      const amountMinor =
        input.amount !== undefined
          ? Math.abs(toMinor(input.amount, currency))
          : current.amountMinor;
      const type = input.type ?? current.type;
      const categoryId =
        input.categoryId !== undefined ? input.categoryId : current.categoryId;

      await ctx.repos.transactions.updateById(ctx.accountId, input.id, {
        amountMinor,
        currency,
        type,
        categoryId,
        note: input.note !== undefined ? input.note : current.note,
        occurredAt: (await normalizeOccurredAt(ctx, input.occurredAt)) ?? current.occurredAt,
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      ctx.waitUntil(
        publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency)
          .catch((error) => log.api.error("publish-balance", error)),
      );

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
      ctx.waitUntil(
        publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, await accountCurrency(ctx))
          .catch((error) => log.api.error("publish-balance", error)),
      );

      return { ok: true, newBalance };
    }),
});
