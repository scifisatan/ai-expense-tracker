import type { CloudflareBindings } from "@/apps/env"
import { createDb } from "@/db/client"
import { createRepositories } from "@api/repositories"
import { router } from "@api/router"
import type { TelegramIdentity } from "@api/trpc"

export function createBotCaller(
  env: CloudflareBindings,
  context: { accountId: string | null; telegram: TelegramIdentity }
) {
  const db = createDb(env.DB)
  const repos = createRepositories(db)

  return router.createCaller({
    db,
    repos,
    env,
    accountId: context.accountId,
    actor: "bot",
    telegram: context.telegram
  })
}

export type BotCaller = ReturnType<typeof createBotCaller>
