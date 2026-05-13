import { initTRPC, TRPCError } from "@trpc/server"
import type { AuthService } from "@/services/auth"
import type { LedgerService } from "@/services/ledger"
import { log } from "@/utils/logger"

export type ApiServices = {
  auth: () => AuthService
  ledger: LedgerService
}

export type ApiContext = {
  chatId: number | null
  services: ApiServices
}

export const t = initTRPC.context<ApiContext>().create()

export const loggerMiddleware = t.middleware(async ({ path, type, next, rawInput }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start
  
  if (result.ok) {
    log.trpc.debug(`${path} (${type}) - OK (${durationMs}ms)`)
  } else {
    log.trpc.error(`${path} (${type}) - ERROR: ${result.error.message} (${durationMs}ms)`)
  }
  
  return result
})

export const publicProcedure = t.procedure.use(loggerMiddleware)

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.chatId === null) throw new TRPCError({ code: "UNAUTHORIZED" })
  return next({
    ctx: {
      chatId: ctx.chatId
    }
  })
})
