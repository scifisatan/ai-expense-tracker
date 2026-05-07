import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

export const t = initTRPC.context<{ chatId: number | null; db: D1Database; env: any }>().create();

export const router = t.router({
  auth: {
    session: t.procedure.query(({ ctx }) => ({
      authenticated: !!ctx.chatId,
      chatId: ctx.chatId,
    })),
    requestOtp: t.procedure
      .input(
        z.object({
          username: z.string().optional(),
          chatId: z.number().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const token = ctx.env.BOT_TOKEN;
        if (!token) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing bot token" });

        let chatId = input.chatId;
        const username = input.username?.replace(/^@/, "").trim();

        if (!chatId && username) {
          const user = await ctx.db
            .prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)")
            .bind(username)
            .first<{ user_id: number }>();

          if (user) {
            chatId = user.user_id;
          } else {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Username not found. Please send /start to the bot first to register.",
            });
          }
        }

        if (!chatId) throw new TRPCError({ code: "BAD_REQUEST", message: "Username or Chat ID is required." });

        // Lazy load TokenSessionManager
        const { TokenSessionManager } = await import("./services/auth/token-manager");
        const secret = ctx.env.WEBAPP_AUTH_SECRET ?? ctx.env.BOT_TOKEN;
        if (!secret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing auth secret" });
        const manager = new TokenSessionManager(secret);

        const { challengeToken, otp } = await manager.issueOtpChallenge(chatId);

        const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🔐 Budget Bot Web Login OTP: ${otp}\n\nThis code expires in 5 minutes.`,
          }),
        });

        const telegramJson = (await telegramRes.json().catch(() => null)) as {
          ok?: boolean;
          description?: string;
        } | null;

        if (!telegramRes.ok || !telegramJson?.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              telegramJson?.description ??
              "Could not send OTP to Telegram. Ensure you already started the bot in that chat.",
          });
        }

        return { challengeToken, expiresInSeconds: 300 };
      }),
    verifyOtp: t.procedure
      .input(
        z.object({
          username: z.string().optional(),
          chatId: z.number().optional(),
          otp: z.string(),
          challengeToken: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        let chatId = input.chatId;
        const username = input.username?.replace(/^@/, "").trim();
        const otp = input.otp.trim();
        const challengeToken = input.challengeToken;

        if (!chatId && username) {
          const user = await ctx.db
            .prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)")
            .bind(username)
            .first<{ user_id: number }>();

          if (!user) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Username not found. Please send /start to the bot first.",
            });
          }

          chatId = user.user_id;
        }

        if (!chatId || otp.length !== 6 || !challengeToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid OTP verification payload." });
        }

        const { TokenSessionManager } = await import("./services/auth/token-manager");
        const secret = ctx.env.WEBAPP_AUTH_SECRET ?? ctx.env.BOT_TOKEN;
        if (!secret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing auth secret" });
        const manager = new TokenSessionManager(secret);

        const isValid = await manager.verifyOtpChallenge(challengeToken, chatId, otp);

        if (!isValid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP." });
        }

        const sessionToken = await manager.issueSession(chatId);

        // We can't set headers directly here easily in TRPC middleware to be reflected in browser cookies
        // without more complex setup, so we rely on the frontend setting the cookie from the response.
        return { ok: true, sessionToken };
      }),
  },
  transactions: {
    list: t.procedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });
        const results = await ctx.db
          .prepare("SELECT id, amount, type, note FROM transactions WHERE chat_id = ? ORDER BY id DESC LIMIT ?")
          .bind(ctx.chatId, input.limit)
          .all<{ id: number; amount: number; type: string; note: string | null }>();
        return { items: results.results };
      }),
    update: t.procedure
      .input(z.object({
        id: z.number(),
        amount: z.number().optional(),
        type: z.string().optional(),
        note: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });
        await ctx.db
          .prepare("UPDATE transactions SET amount = COALESCE(?, amount), type = COALESCE(?, type), note = COALESCE(?, note) WHERE id = ? AND chat_id = ?")
          .bind(input.amount, input.type, input.note, input.id, ctx.chatId)
          .run();
        return { ok: true };
      }),
    delete: t.procedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (input.ids.length === 0) return { ok: true };
        const placeholders = input.ids.map(() => "?").join(",");
        await ctx.db
          .prepare(`DELETE FROM transactions WHERE chat_id = ? AND id IN (${placeholders})`)
          .bind(ctx.chatId, ...input.ids)
          .run();
        return { ok: true };
      }),
  },
  insights: {
    summary: t.procedure.query(async ({ ctx }) => {
      if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const row = await ctx.db.prepare(
        `
          SELECT
            COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense,
            COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END), 0) AS net,
            COUNT(*) AS transactions
          FROM transactions
          WHERE chat_id = ?
        `,
      )
        .bind(ctx.chatId)
        .first<{ income: number; expense: number; net: number; transactions: number }>();
      return {
        income: Number(row?.income ?? 0),
        expense: Number(row?.expense ?? 0),
        net: Number(row?.net ?? 0),
        transactions: Number(row?.transactions ?? 0),
      };
    }),
  },
});

export type AppRouter = typeof router;
