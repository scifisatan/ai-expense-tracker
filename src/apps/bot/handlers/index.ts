import type { Bot } from "grammy"
import type { BotContext } from "@bot/types"
import { registerCommandHandlers } from "./commands"
import { registerMessageHandlers } from "./messages"
import { registerCallbackHandlers } from "./callbacks"

export const registerHandlers = (bot: Bot<BotContext>) => {
  registerCommandHandlers(bot)
  registerMessageHandlers(bot)
  registerCallbackHandlers(bot)
}
