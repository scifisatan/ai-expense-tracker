import { z } from "zod";
import { t, protectedProcedure } from "../trpc";
import { createAiService } from "@/services/ai";
import { publishBalance } from "@api/lib/ledger";
import { consumeAiQuota } from "@api/lib/rate-limit";
import { toMinor } from "@/shared/money";
import type { Category } from "@/db/schema";

const DEFAULT_AI_DAILY_LIMIT = 50;
const DEFAULT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const resolveCategoryId = (
  categories: Category[],
  hint: string | undefined,
  type: "Income" | "Expense",
): number | null => {
  if (!hint) return null;
  const normalized = hint.trim().toLowerCase();
  const match = categories.find(
    (c) => c.type === type && c.name.toLowerCase() === normalized,
  );
  return match?.id ?? null;
};

export const ledgerRouter = t.router({
  // Natural-language ingestion. Shared by the bot and the web NL entry box.
  ingestText: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const account = await ctx.repos.accounts.findById(ctx.accountId);
      const currency = account?.defaultCurrency ?? "USD";

      const dailyLimit = Number(ctx.env.AI_DAILY_LIMIT ?? DEFAULT_AI_DAILY_LIMIT);
      const quota = await consumeAiQuota(ctx.env.BOT_INFO, ctx.accountId, dailyLimit);
      if (!quota.allowed) {
        return { items: [], net: 0, newBalance: null, currency, reason: "RATE_LIMITED" as const };
      }

      const ai = createAiService({
        model: ctx.env.AI_MODEL || DEFAULT_AI_MODEL,
        ai: ctx.env.AI,
        gateway: ctx.env.AI_GATEWAY ?? "",
        groqApiKey: ctx.env.GROQ_API_KEY ?? "",
      });

      const extracted = await ai.extractTransactions(input.text);
      if (!extracted.items.length) {
        return { items: [], net: 0, newBalance: null, currency, reason: "NO_ITEMS" as const };
      }

      const categories = await ctx.repos.categories.listByAccount(ctx.accountId);

      const items = extracted.items.map((item) => ({
        amountMinor: Math.abs(toMinor(item.amount, currency)),
        type: item.type,
        note: item.note,
        currency,
        categoryId: resolveCategoryId(categories, item.category, item.type),
      }));

      await ctx.repos.transactions.insertLedger({
        accountId: ctx.accountId,
        items,
        source: ctx.actor === "bot" ? "telegram" : "web",
        fallbackNote: input.text,
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency);

      const net = items.reduce(
        (sum, item) => sum + (item.type === "Income" ? item.amountMinor : -item.amountMinor),
        0,
      );

      return { items, net, newBalance, currency, reason: null };
    }),

  refreshBalance: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await ctx.repos.accounts.findById(ctx.accountId);
    const currency = account?.defaultCurrency ?? "USD";
    const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
    await publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency);
    return { newBalance };
  }),
});
