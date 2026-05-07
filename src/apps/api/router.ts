import { initTRPC, TRPCError } from "@trpc/server"
import type { AuthService } from "@/shared/service/auth-service"
import type { LedgerService } from "@/shared/service/ledger-service"
import { requestOtpInputSchema, verifyOtpInputSchema } from "@/shared/types/auth"
import {
  transactionsDeleteInputSchema,
  transactionsListInputSchema,
  transactionsUpdateInputSchema
} from "@/shared/types/ledger"

export type ApiServices = {
  auth: () => AuthService
  ledger: LedgerService
}

type ApiContext = {
  chatId: number | null
  services: ApiServices
}

export const t = initTRPC.context<ApiContext>().create()

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.chatId === null) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({
    ctx: {
      chatId: ctx.chatId
    }
  })
})

const getAuth = (services: ApiServices) => {
  try {
    return services.auth()
  } catch (error) {
    if (error instanceof Error && error.message === "Missing bot token") {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing bot token" })
    }
    if (error instanceof Error && error.message === "Missing auth secret") {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Missing auth secret" })
    }

    throw error
  }
}

const throwRequestOtpError = (error: unknown): never => {
  if (error instanceof Error && error.message === "AUTH_IDENTIFIER_REQUIRED") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Username or Chat ID is required." })
  }
  if (error instanceof Error && error.message === "AUTH_USERNAME_NOT_FOUND") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Username not found. Please send /start to the bot first to register."
    })
  }
  if (error instanceof Error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message })
  }

  throw error
}

const throwVerifyOtpError = (error: unknown): never => {
  if (error instanceof Error && error.message === "AUTH_USERNAME_NOT_FOUND") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Username not found. Please send /start to the bot first."
    })
  }
  if (error instanceof Error && error.message === "AUTH_INVALID_OTP_PAYLOAD") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid OTP verification payload."
    })
  }
  if (error instanceof Error && error.message === "AUTH_INVALID_OTP") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP." })
  }
  if (error instanceof Error && error.message === "AUTH_IDENTIFIER_REQUIRED") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Username or Chat ID is required." })
  }

  throw error
}

const throwLedgerMutationError = (error: unknown): never => {
  if (error instanceof Error && error.message === "TRANSACTION_NOT_FOUND") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" })
  }

  throw error
}

export const router = t.router({
  auth: {
    session: t.procedure.query(({ ctx }) => ({
      authenticated: !!ctx.chatId,
      chatId: ctx.chatId
    })),
    logout: t.procedure.mutation(() => ({ ok: true })),
    requestOtp: t.procedure.input(requestOtpInputSchema).mutation(async ({ input, ctx }) => {
      const auth = getAuth(ctx.services)

      try {
        return await auth.requestOtp(input)
      } catch (error) {
        return throwRequestOtpError(error)
      }
    }),
    verifyOtp: t.procedure.input(verifyOtpInputSchema).mutation(async ({ input, ctx }) => {
      const auth = getAuth(ctx.services)

      try {
        const result = await auth.verifyOtp(input)
        return { ok: true, sessionToken: result.sessionToken }
      } catch (error) {
        return throwVerifyOtpError(error)
      }
    })
  },
  transactions: {
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
  },
  insights: {
    summary: protectedProcedure.query(async ({ ctx }) => {
      return ctx.services.ledger.getSummary(ctx.chatId)
    })
  }
})

export type APIRouter = typeof router
