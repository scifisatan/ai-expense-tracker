import { Hono } from "hono"
import { trpcServer } from "@hono/trpc-server"
import { router, type ApiServices } from "@api/router"
import type { AppEnv, CloudflareBindings } from "@/apps/env"
import { SESSION_COOKIE } from "@/utils/constants"
import { getCookie } from "@/utils/cookies"
import { createTokenSession } from "@/shared/service/auth-service"
import { createAppContext } from "@/shared/service/create-app-context"
import { createTelegramBalancePublisher } from "@/shared/service/telegram-bot-service"

const apiRoutes = new Hono<AppEnv>()

const createApiServices = (env: CloudflareBindings): ApiServices => {
  const botToken = env.BOT_TOKEN
  const appContext = createAppContext({
    db: env.DB,
    env,
    telegram: {
      balancePublisher: createTelegramBalancePublisher(botToken),
      botToken
    }
  })

  return {
    auth: appContext.createOtpAuth,
    ledger: appContext.ledger
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
