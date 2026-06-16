export type SessionPayload = {
  accountId: string
  exp: number
}

const base64UrlEncode = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return atob(normalized + pad)
}

const hmac = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signed)))
}

const signToken = async (secret: string, payload: unknown): Promise<string> => {
  const body = base64UrlEncode(JSON.stringify(payload))
  const sig = await hmac(secret, body)
  return `${body}.${sig}`
}

const verifyToken = async <T>(secret: string, token: string): Promise<T | null> => {
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  if (sig !== (await hmac(secret, body))) return null

  try {
    return JSON.parse(base64UrlDecode(body)) as T
  } catch {
    return null
  }
}

export const createTokenSession = (secret: string) => ({
  async issueSession(accountId: string): Promise<string> {
    return signToken(secret, {
      accountId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })
  },

  async verifySession(token: string): Promise<SessionPayload | null> {
    const payload = await verifyToken<SessionPayload>(secret, token)
    if (!payload || payload.exp < Date.now()) return null
    return payload
  },

  // Generic signed payload used for OAuth `state` (CSRF protection).
  async signState(payload: Record<string, unknown>, ttlMs = 10 * 60 * 1000): Promise<string> {
    return signToken(secret, { ...payload, exp: Date.now() + ttlMs })
  },

  async verifyState<T extends { exp: number }>(token: string): Promise<T | null> {
    const payload = await verifyToken<T>(secret, token)
    if (!payload || payload.exp < Date.now()) return null
    return payload
  }
})

export type TokenSession = ReturnType<typeof createTokenSession>
