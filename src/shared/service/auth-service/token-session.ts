export type SessionPayload = {
  chatId: number
  exp: number
}

type OtpChallengePayload = {
  chatId: number
  nonce: string
  otpHash: string
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

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

const signToken = async (secret: string, payload: unknown): Promise<string> => {
  const body = base64UrlEncode(JSON.stringify(payload))
  const sig = await hmac(secret, body)
  return `${body}.${sig}`
}

export const createTokenSession = (secret: string) => ({
  async issueSession(chatId: number): Promise<string> {
    return signToken(secret, {
      chatId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    })
  },

  async verifySession(token: string): Promise<SessionPayload | null> {
    const [body, sig] = token.split(".")
    if (!body || !sig) return null
    if (sig !== (await hmac(secret, body))) return null

    try {
      const payload = JSON.parse(base64UrlDecode(body)) as SessionPayload
      if (payload.exp < Date.now()) return null
      return payload
    } catch {
      return null
    }
  },

  async issueOtpChallenge(chatId: number) {
    const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0")
    const nonce = crypto.randomUUID()
    const exp = Date.now() + 5 * 60 * 1000
    const otpHash = await sha256Hex(`${otp}:${chatId}:${nonce}`)

    const challengeToken = await signToken(secret, {
      chatId,
      nonce,
      otpHash,
      exp
    } as OtpChallengePayload)

    return { challengeToken, otp }
  },

  async verifyOtpChallenge(challengeToken: string, chatId: number, otp: string): Promise<boolean> {
    const [body, sig] = challengeToken.split(".")
    if (!body || !sig) return false
    if (sig !== (await hmac(secret, body))) return false

    try {
      const challenge = JSON.parse(base64UrlDecode(body)) as OtpChallengePayload
      if (challenge.exp < Date.now() || challenge.chatId !== chatId) return false

      const actualHash = await sha256Hex(`${otp}:${chatId}:${challenge.nonce}`)
      return actualHash === challenge.otpHash
    } catch {
      return false
    }
  }
})

export type TokenSession = ReturnType<typeof createTokenSession>
