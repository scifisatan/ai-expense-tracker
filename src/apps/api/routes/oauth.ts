import { Hono } from "hono"
import type { AppEnv } from "@/apps/env"

import { createDb } from "@/db/client"
import { createRepositories } from "@api/repositories"
import { createTokenSession } from "@api/lib/token-session"
import { getCookie } from "@/utils/cookies"
import { SESSION_COOKIE, OAUTH_STATE_COOKIE } from "@/utils/constants"
import { log } from "@/utils/logger"

const oauthRoutes = new Hono<AppEnv>()

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

type GoogleIdClaims = {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
}

// The redirect URI must exactly match what is registered in the Google OAuth client.
const redirectUri = (c: { env: AppEnv["Bindings"]; req: { url: string } }) => {
  const base = c.env.APP_URL?.replace(/\/$/, "") ?? new URL(c.req.url).origin
  return `${base}/api/auth/google/callback`
}

const cookie = (name: string, value: string, maxAge: number, secure: boolean) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`

const decodeJwtPayload = <T>(jwt: string): T | null => {
  const part = jwt.split(".")[1]
  if (!part) return null
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  try {
    return JSON.parse(atob(normalized + pad)) as T
  } catch {
    return null
  }
}

// Sign out: clear the HttpOnly session cookie server-side (JS can't touch it).
oauthRoutes.post("/logout", (c) => {
  const secure = new URL(c.req.url).protocol === "https:"
  c.header("Set-Cookie", cookie(SESSION_COOKIE, "", 0, secure))
  return c.json({ ok: true })
})

oauthRoutes.get("/google", async (c) => {
  const { GOOGLE_CLIENT_ID, SESSION_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !SESSION_SECRET) {
    return c.text("Google OAuth is not configured.", 500)
  }

  const session = createTokenSession(SESSION_SECRET)
  const state = await session.signState({ nonce: crypto.randomUUID() })

  const secure = new URL(c.req.url).protocol === "https:"
  c.header("Set-Cookie", cookie(OAUTH_STATE_COOKIE, state, 600, secure))

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(c),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  })

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`)
})

oauthRoutes.get("/google/callback", async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SESSION_SECRET) {
    return c.text("Google OAuth is not configured.", 500)
  }

  const code = c.req.query("code")
  const state = c.req.query("state")
  const stateCookie = getCookie(c.req.header("cookie") ?? null, OAUTH_STATE_COOKIE)

  // CSRF protection: state must be present, signed, unexpired, and match the cookie.
  const session = createTokenSession(SESSION_SECRET)
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return c.text("Invalid OAuth state.", 400)
  }
  const verifiedState = await session.verifyState<{ exp: number }>(state)
  if (!verifiedState) {
    return c.text("OAuth state expired. Please try again.", 400)
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(c),
        grant_type: "authorization_code",
      }),
    })

    const tokenJson = (await tokenRes.json().catch(() => null)) as { id_token?: string } | null
    if (!tokenRes.ok || !tokenJson?.id_token) {
      log.trpc.error("oauth.google.token_exchange_failed")
      return c.text("Failed to authenticate with Google.", 502)
    }

    const claims = decodeJwtPayload<GoogleIdClaims>(tokenJson.id_token)
    if (!claims?.sub || !claims.email) {
      return c.text("Google did not return a usable profile.", 502)
    }

    const db = createDb(c.env.DB)
    const repos = createRepositories(db)
    const account = await repos.accounts.upsertByOauth({
      provider: "google",
      subject: claims.sub,
      email: claims.email,
      name: claims.name ?? null,
    })

    const sessionToken = await session.issueSession(account.id)
    const secure = new URL(c.req.url).protocol === "https:"

    c.header("Set-Cookie", cookie(SESSION_COOKIE, sessionToken, 7 * 24 * 60 * 60, secure))
    // Clear the one-time state cookie.
    c.header("Set-Cookie", cookie(OAUTH_STATE_COOKIE, "", 0, secure), { append: true })

    return c.redirect("/app")
  } catch (error) {
    log.trpc.error("oauth.google.callback_error", error)
    return c.text("Authentication failed.", 500)
  }
})

export default oauthRoutes
