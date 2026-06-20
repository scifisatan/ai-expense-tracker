import { z } from "zod";
import { t, protectedProcedure } from "../trpc";
import { createAiService } from "@/services/ai";
import { publishBalance } from "@api/lib/ledger";
import { checkBudgetAlerts } from "@api/lib/budgets";
import { consumeAiQuota } from "@api/lib/rate-limit";
import { toMinor } from "@/shared/money";
import { localDateString, normalizeBackdate } from "@/shared/datetime";
import type { Category } from "@/db/schema";

const DEFAULT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const categoryKey = (type: "Income" | "Expense", name: string) =>
  `${type}|${name.trim().toLowerCase()}`;

export const ledgerRouter = t.router({
  // Natural-language ingestion. Shared by the bot and the web NL entry box.
  ingestText: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const account = await ctx.repos.accounts.findById(ctx.accountId);
      // Single-currency per account: every row is stored in the account default,
      // so the balance SUM stays coherent (no FX).
      const currency = account?.defaultCurrency ?? "USD";
      const timezone = account?.timezone ?? "UTC";

      const quota = await consumeAiQuota(ctx.env.AI_QUOTA, ctx.accountId);
      if (!quota.allowed) {
        return { items: [], net: 0, newBalance: null, currency, insertedIds: [], reason: "RATE_LIMITED" as const };
      }

      const ai = createAiService({
        model: ctx.env.AI_MODEL || DEFAULT_AI_MODEL,
        groqApiKey: ctx.env.GROQ_API_KEY ?? "",
      });

      const extracted = await ai.extractTransactions(input.text, localDateString(timezone));
      if (!extracted.items.length) {
        return { items: [], net: 0, newBalance: null, currency, insertedIds: [], reason: "NO_ITEMS" as const };
      }

      // Seed a mutable lookup from existing categories so repeated hints in one
      // batch reuse (and don't re-create) the same category.
      const categories = await ctx.repos.categories.listByAccount(ctx.accountId);
      const categoryByKey = new Map<string, Category>(
        categories.map((c) => [categoryKey(c.type, c.name), c]),
      );

      const resolveCategoryId = async (
        hint: string | undefined,
        type: "Income" | "Expense",
      ): Promise<number | null> => {
        const name = hint?.trim();
        if (!name) return null;
        const existing = categoryByKey.get(categoryKey(type, name));
        if (existing) return existing.id;
        const [created] = await ctx.repos.categories.create(ctx.accountId, { name, type });
        categoryByKey.set(categoryKey(type, name), created);
        return created.id;
      };

      const items: Array<{
        amountMinor: number;
        type: "Income" | "Expense";
        note: string;
        currency: string;
        categoryId: number | null;
        occurredAt?: string;
      }> = [];
      for (const item of extracted.items) {
        items.push({
          amountMinor: Math.abs(toMinor(item.amount, currency)),
          type: item.type,
          note: item.note,
          currency,
          categoryId: await resolveCategoryId(item.category, item.type),
          occurredAt: item.occurredAt
            ? (normalizeBackdate(item.occurredAt, timezone) ?? undefined)
            : undefined,
        });
      }

      const inserted = await ctx.repos.transactions.insertLedger({
        accountId: ctx.accountId,
        items,
        source: ctx.actor === "bot" ? "telegram" : "web",
        fallbackNote: input.text,
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency);
      await checkBudgetAlerts(ctx, items);

      const net = items.reduce(
        (sum, item) => sum + (item.type === "Income" ? item.amountMinor : -item.amountMinor),
        0,
      );

      return { items, net, newBalance, currency, insertedIds: inserted.map((r) => r.id), reason: null };
    }),

  refreshBalance: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId);
    const currency = account?.defaultCurrency ?? "USD";
    const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
    await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency);
    return { newBalance };
  }),
});
