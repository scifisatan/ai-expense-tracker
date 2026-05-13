import { AuthIdentifier, VerifyOtpInput } from "@/shared/types"
import { sendTelegramOtp } from "@/services/auth/telegram-otp"
import { createTokenSession, type TokenSession } from "@/services/auth/token-session"

type AuthServiceDeps = {
  session: TokenSession
  sendOtp?: (chatId: number, otp: string) => Promise<void>
}

export type AuthService = {
  requestOtp(input: AuthIdentifier): Promise<{ challengeToken: string; expiresInSeconds: number }>
  verifyOtp(input: VerifyOtpInput): Promise<{ sessionToken: string }>
}

export const createAuthService = (deps: AuthServiceDeps): AuthService => {
  const resolveChatId = async (input: AuthIdentifier): Promise<number> => {
    if (input.chatId) return input.chatId
    throw new Error("Invalid Chat ID")
  }

  return {
    async requestOtp(input) {
      const chatId = await resolveChatId(input)
      if (!deps.sendOtp) throw new Error("AUTH_OTP_MESSENGER_NOT_CONFIGURED")

      const { challengeToken, otp } = await deps.session.issueOtpChallenge(chatId)
      await deps.sendOtp(chatId, otp)
      return { challengeToken, expiresInSeconds: 300 }
    },

    async verifyOtp(input) {
      const chatId = await resolveChatId(input)
      const otp = input.otp.trim()
      const challengeToken = input.challengeToken

      if (otp.length !== 6 || !challengeToken) {
        throw new Error("AUTH_INVALID_OTP_PAYLOAD")
      }

      const isValid = await deps.session.verifyOtpChallenge(challengeToken, chatId, otp)
      if (!isValid) throw new Error("AUTH_INVALID_OTP")

      const sessionToken = await deps.session.issueSession(chatId)
      return { sessionToken }
    }
  }
}

export const createTelegramAuthService = (config: { botToken?: string; authSecret?: string }) => {
  if (!config.botToken) throw new Error("Missing bot token")
  if (!config.authSecret) throw new Error("Missing auth secret")

  return createAuthService({
    sendOtp: (chatId, otp) => sendTelegramOtp(config.botToken!, chatId, otp),
    session: createTokenSession(config.authSecret)
  })
}

export { createTokenSession }
export type { TokenSession }
