import { Hono } from "hono"
import { trpcServer } from "@hono/trpc-server"
import { router, type ApiServices } from "@api/router"
import type { AppEnv, CloudflareBindings } from "@/apps/env"
import { SESSION_COOKIE } from "@/utils/constants"
import { getCookie } from "@/utils/cookies"
import { createDb } from '@/db/client'
import { createTelegramAuthService, createTokenSession } from "@/services/auth"
import { createLedgerService } from "@/services/ledger"
import { createTelegramBalancePublisher } from "@/services/telegram-balance"
import { log } from "@/utils/logger"

const apiRoutes = new Hono<AppEnv>()

apiRoutes.use("*", async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  log.api.info(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`)
})

const createApiServices = (env: CloudflareBindings): ApiServices => {
  const db = createDb(env.DB)
  const botToken = env.BOT_TOKEN
  const balancePublisher = createTelegramBalancePublisher(botToken)
  const ledger = createLedgerService(db, balancePublisher)

  return {
    auth: () => createTelegramAuthService({
      botToken,
      authSecret: botToken
    }),
    ledger
  }
}

const getSessionChatId = async (request: Request, secret?: string): Promise<number | null> => {
  const cookieHeader = request.headers.get("cookie")
  const token = getCookie(cookieHeader, SESSION_COOKIE)

  if (!token || !secret) return null

  const session = await createTokenSession(secret).verifySession(token)
  return session?.chatId ?? null
}

apiRoutes.all("/*", async (c, next) => {
  const chatId = await getSessionChatId(c.req.raw, c.env.BOT_TOKEN)
  const services = createApiServices(c.env)

  const handler = trpcServer({
    router,
    endpoint: "/api",
    createContext: () => ({
      chatId,
      services
    })
  })

  return handler(c, next)
})

export default apiRoutes
