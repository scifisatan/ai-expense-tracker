import type { Context } from "hono"

export type CloudflareBindings = {
  BOT_INFO: KVNamespace
  BOT_TOKEN?: string
  AI_MODEL?: string
  WEBHOOK_URL?: string
  DB: D1Database
  SESSION_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  APP_URL?: string
}

export type AppEnv = {
  Bindings: CloudflareBindings
}

export type AppContext = Context<AppEnv>
