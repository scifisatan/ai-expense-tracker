import { z } from "zod";
import { t, protectedProcedure } from "../trpc";
import { createAiService } from "@/services/ai";
import { publishBalance } from "@api/lib/ledger";
import { consumeAiQuota } from "@api/lib/rate-limit";
import { toMinor } from "@/shared/money";
import { localDateString, normalizeBackdate } from "@/shared/datetime";
import { log } from "@/utils/logger";
import type { Category } from "@/db/schema";
import type { TransactionsExtraction } from "@/shared/types";

const DEFAULT_AI_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_AI_DAILY_LIMIT = 50;

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

      const dailyLimit = Number(ctx.env.AI_DAILY_LIMIT ?? DEFAULT_AI_DAILY_LIMIT);
      const quota = await consumeAiQuota(ctx.env.BOT_INFO, ctx.accountId, dailyLimit);
      if (!quota.allowed) {
        return { items: [], net: 0, newBalance: null, currency, insertedIds: [], reason: "RATE_LIMITED" as const };
      }

      const ai = createAiService({
        model: ctx.env.AI_MODEL || DEFAULT_AI_MODEL,
        groqApiKey: ctx.env.GROQ_API_KEY ?? "",
      });

      // Fetch categories up front so the AI only picks from names that already
      // exist (categories are created deliberately in Settings, never by the AI).
      const categories = await ctx.repos.categories.listByAccount(ctx.accountId);

      let extracted: TransactionsExtraction;
      try {
        extracted = await ai.extractTransactions(input.text, localDateString(timezone), {
          expense: categories.filter((c) => c.type === "Expense").map((c) => c.name),
          income: categories.filter((c) => c.type === "Income").map((c) => c.name),
        });
      } catch (error) {
        // The AI service already retried; degrade gracefully instead of surfacing a
        // 500 to the web NL box / Telegram bot.
        log.ai.error("ledger.ingestText.ai_failed", error);
        return { items: [], net: 0, newBalance: null, currency, insertedIds: [], reason: "AI_ERROR" as const };
      }
      if (!extracted.items.length) {
        return { items: [], net: 0, newBalance: null, currency, insertedIds: [], reason: "NO_ITEMS" as const };
      }

      // Match-only resolution: an AI hint either matches an existing category
      // (case-insensitively) or the item stays uncategorized. New categories are
      // never created here.
      const categoryByKey = new Map<string, Category>(
        categories.map((c) => [categoryKey(c.type, c.name), c]),
      );

      const resolveCategory = (
        hint: string | undefined,
        type: "Income" | "Expense",
      ): Category | null => {
        const name = hint?.trim();
        if (!name) return null;
        return categoryByKey.get(categoryKey(type, name)) ?? null;
      };

      const items = extracted.items.map((item) => {
        const category = resolveCategory(item.category, item.type);
        return {
          amountMinor: Math.abs(toMinor(item.amount, currency)),
          type: item.type,
          note: item.note,
          currency,
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          occurredAt: item.occurredAt
            ? (normalizeBackdate(item.occurredAt, timezone) ?? undefined)
            : undefined,
        };
      });

      const inserted = await ctx.repos.transactions.insertLedger({
        accountId: ctx.accountId,
        items,
        source: ctx.actor === "bot" ? "telegram" : "web",
        fallbackNote: input.text,
      });

      const newBalance = await ctx.repos.transactions.getNetBalance(ctx.accountId);
      ctx.waitUntil(
        publishBalance(ctx.env.BOT_TOKEN, ctx.db, ctx.accountId, newBalance, currency)
          .catch((error) => log.api.error("publish-balance", error)),
      );

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
    return { newBalance, currency };
  }),
});
