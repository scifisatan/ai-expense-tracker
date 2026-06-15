import { initTRPC, TRPCError } from "@trpc/server"
import type { CloudflareBindings } from "@/apps/env"
import type { AppDb } from "@/db/client"
import type { ApiRepositories } from "@api/repositories"
import { log } from "@/utils/logger"

export type TelegramIdentity = {
  chatId: number
  userId?: number
  username?: string
  firstName?: string
  lastName?: string
}

export type ApiContext = {
  db: AppDb
  env: CloudflareBindings
  repos: ApiRepositories
  accountId: string | null
  actor: "web" | "bot"
  // Present only for bot-originated calls; carries the Telegram identity even when
  // the chat is not yet linked to an account (used by the link-code flow).
  telegram?: TelegramIdentity | null
}

export const t = initTRPC.context<ApiContext>().create()

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
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

const requireAccount = t.middleware(({ ctx, next }) => {
  if (ctx.accountId === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: {
      ...ctx,
      accountId: ctx.accountId
    }
  })
})

export const publicProcedure = t.procedure.use(loggerMiddleware)
export const protectedProcedure = publicProcedure.use(requireAccount)
