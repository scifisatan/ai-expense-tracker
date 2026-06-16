import type { Context } from "grammy"
import type { BotCaller } from "@api/caller"
import type { CloudflareBindings } from "@/apps/env"

export type BotContext = Context & {
  env: CloudflareBindings
  actor: "bot"
  // null when the chat is not linked to any account yet.
  accountId: string | null
  caller: BotCaller
}
