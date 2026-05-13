import { TRPCError } from "@trpc/server"
import { t, publicProcedure, type ApiServices } from "../trpc"
import { requestOtpInputSchema, verifyOtpInputSchema } from "@/shared/types"

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

export const authRouter = t.router({
  session: publicProcedure.query(({ ctx }) => ({
    authenticated: !!ctx.chatId,
    chatId: ctx.chatId
  })),
  logout: publicProcedure.mutation(() => ({ ok: true })),
  requestOtp: publicProcedure.input(requestOtpInputSchema).mutation(async ({ input, ctx }) => {
    const auth = getAuth(ctx.services)

    try {
      return await auth.requestOtp(input)
    } catch (error) {
      return throwRequestOtpError(error)
    }
  }),
  verifyOtp: publicProcedure.input(verifyOtpInputSchema).mutation(async ({ input, ctx }) => {
    const auth = getAuth(ctx.services)

    try {
      const result = await auth.verifyOtp(input)
      return { ok: true, sessionToken: result.sessionToken }
    } catch (error) {
      return throwVerifyOtpError(error)
    }
  })
})
