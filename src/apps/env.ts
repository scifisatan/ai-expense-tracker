import type { Context } from "hono"

export type CloudflareBindings = {
  BOT_INFO: KVNamespace
  AI_QUOTA: RateLimit
  BOT_TOKEN?: string
  AI_MODEL?: string
  GROQ_API_KEY?: string
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
