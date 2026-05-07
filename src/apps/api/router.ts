import { initTRPC, TRPCError } from "@trpc/server";
import { createAppContext } from "@/shared/service/create-app-context";
import { requestOtpInputSchema, verifyOtpInputSchema } from "@/shared/types/auth";
import {
  transactionsDeleteInputSchema,
  transactionsListInputSchema,
  transactionsUpdateInputSchema,
} from "@/shared/types/ledger";

export const t = initTRPC.context<{ chatId: number | null; db: D1Database; env: any }>().create();

const getAppContext = (db: D1Database, env: any) => createAppContext({ db, env });

const getAuth = (db: D1Database, env: any) => {
  try {
    return getAppContext(db, env).createOtpAuthModule();
  } catch (error) {
    if (error instanceof Error && error.message === "Missing bot token") {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing bot token" });
    }
    if (error instanceof Error && error.message === "Missing auth secret") {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing auth secret" });
    }

    throw error;
  }
};

export const router = t.router({
  auth: {
    session: t.procedure.query(({ ctx }) => ({
      authenticated: !!ctx.chatId,
      chatId: ctx.chatId,
    })),
    logout: t.procedure.mutation(() => ({ ok: true })),
    requestOtp: t.procedure.input(requestOtpInputSchema).mutation(async ({ input, ctx }) => {
      const auth = getAuth(ctx.db, ctx.env);

      try {
        return await auth.requestOtp(input);
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_IDENTIFIER_REQUIRED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Username or Chat ID is required." });
        }
        if (error instanceof Error && error.message === "AUTH_USERNAME_NOT_FOUND") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Username not found. Please send /start to the bot first to register.",
          });
        }
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }

        throw error;
      }
    }),
    verifyOtp: t.procedure.input(verifyOtpInputSchema).mutation(async ({ input, ctx }) => {
      const auth = getAuth(ctx.db, ctx.env);

      try {
        const result = await auth.verifyOtp(input);
        return { ok: true, sessionToken: result.sessionToken };
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_USERNAME_NOT_FOUND") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Username not found. Please send /start to the bot first.",
          });
        }
        if (error instanceof Error && error.message === "AUTH_INVALID_OTP_PAYLOAD") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid OTP verification payload.",
          });
        }
        if (error instanceof Error && error.message === "AUTH_INVALID_OTP") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP." });
        }
        if (error instanceof Error && error.message === "AUTH_IDENTIFIER_REQUIRED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Username or Chat ID is required." });
        }

        throw error;
      }
    }),
  },
  transactions: {
    list: t.procedure.input(transactionsListInputSchema).query(async ({ input, ctx }) => {
      if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const ledger = getAppContext(ctx.db, ctx.env).ledger;
      const items = await ledger.listRecent(ctx.chatId, input.limit);
      return { items };
    }),
    update: t.procedure.input(transactionsUpdateInputSchema).mutation(async ({ input, ctx }) => {
      if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const ledger = getAppContext(ctx.db, ctx.env).ledger;
      try {
        const result = await ledger.updateTransaction(ctx.chatId, input.id, {
          amount: input.amount,
          type: input.type,
          note: input.note,
        });
        
        await ledger.refreshBalance(ctx.chatId)
        return { ok: true, newBalance: result.newBalance };
      } catch (error) {
        if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }

        throw error;
      }
    }),
    delete: t.procedure.input(transactionsDeleteInputSchema).mutation(async ({ input, ctx }) => {
      if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const ledger = getAppContext(ctx.db, ctx.env).ledger;
      const result = await ledger.deleteTransactions(ctx.chatId, input.ids);
      await ledger.refreshBalance(ctx.chatId)
      return { ok: true, newBalance: result.newBalance };
    }),
  },
  insights: {
    summary: t.procedure.query(async ({ ctx }) => {
      if (!ctx.chatId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const ledger = getAppContext(ctx.db, ctx.env).ledger;
      return ledger.getSummary(ctx.chatId);
    }),
  },
});

export type APIRouter = typeof router;
