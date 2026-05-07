import { Context as GrammyContext } from "grammy"
import { CloudflareBindings } from "@apps/env"

export type BotContext = GrammyContext & {
  env: CloudflareBindings
}
