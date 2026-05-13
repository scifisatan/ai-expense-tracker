import type { Context } from "grammy"
import type { CloudflareBindings } from "@/apps/env"

export type BotContext = Context & {
  env: CloudflareBindings
}
