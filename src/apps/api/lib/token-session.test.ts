import { describe, it, expect } from "vitest"
import { createTokenSession } from "./token-session"

const SECRET = "test-secret-value"

describe("token session", () => {
  it("issues and verifies a session for the same secret", async () => {
    const session = createTokenSession(SECRET)
    const token = await session.issueSession("acc_123")
    const payload = await session.verifySession(token)
    expect(payload?.accountId).toBe("acc_123")
  })

  it("carries the tokenVersion in the signed payload", async () => {
    const session = createTokenSession(SECRET)
    const token = await session.issueSession("acc_123", 5)
    const payload = await session.verifySession(token)
    expect(payload?.tokenVersion).toBe(5)
  })

  it("rejects a token signed with a different secret", async () => {
    const token = await createTokenSession(SECRET).issueSession("acc_123")
    const payload = await createTokenSession("other-secret").verifySession(token)
    expect(payload).toBeNull()
  })

  it("rejects a tampered token", async () => {
    const session = createTokenSession(SECRET)
    const token = await session.issueSession("acc_123")
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa")
    expect(await session.verifySession(tampered)).toBeNull()
  })

  it("signs and verifies state, rejecting expired state", async () => {
    const session = createTokenSession(SECRET)
    const valid = await session.signState({ nonce: "n1" }, 1000)
    expect(await session.verifyState<{ exp: number }>(valid)).not.toBeNull()

    const expired = await session.signState({ nonce: "n2" }, -1000)
    expect(await session.verifyState<{ exp: number }>(expired)).toBeNull()
  })
})
