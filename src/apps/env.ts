import type { Context } from "hono"

export type CloudflareBindings = {
  BOT_TOKEN?: string
  AI_MODEL?: string
  WEBHOOK_URL?: string
  DB: D1Database
}

export type AppEnv = {
  Bindings: CloudflareBindings
}

export type AppContext = Context<AppEnv>
