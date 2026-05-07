import type { AuthIdentityRepo } from "../../ports/auth-identity-repo";
import type { AuthOtpMessenger } from "../../ports/auth-otp-messenger";
import type { AuthSession } from "../../ports/auth-session";
import type { AuthIdentifier, VerifyOtpInput } from "./types";

export interface AuthModule {
  requestOtp(input: AuthIdentifier): Promise<{ challengeToken: string; expiresInSeconds: number }>;
  verifyOtp(input: VerifyOtpInput): Promise<{ sessionToken: string }>;
  getSessionChatId(sessionToken: string): Promise<number | null>;
}

export interface AuthModuleConfig {
  identityRepo?: AuthIdentityRepo;
  otpMessenger?: AuthOtpMessenger;
  session: AuthSession;
}

const normalizeUsername = (username?: string) => username?.replace(/^@/, "").trim();

export const createAuthModule = (config: AuthModuleConfig): AuthModule => {
  const resolveChatId = async (input: AuthIdentifier): Promise<number> => {
    if (input.chatId) return input.chatId;

    const username = normalizeUsername(input.username);
    if (!username) throw new Error("AUTH_IDENTIFIER_REQUIRED");
    if (!config.identityRepo) throw new Error("AUTH_IDENTITY_REPO_NOT_CONFIGURED");

    const chatId = await config.identityRepo.findChatIdByUsername(username);
    if (!chatId) throw new Error("AUTH_USERNAME_NOT_FOUND");

    return chatId;
  };

  return {
    async requestOtp(input) {
      const chatId = await resolveChatId(input);
      if (!config.otpMessenger) throw new Error("AUTH_OTP_MESSENGER_NOT_CONFIGURED");

      const { challengeToken, otp } = await config.session.issueOtpChallenge(chatId);
      await config.otpMessenger.sendOtp(chatId, otp);
      return { challengeToken, expiresInSeconds: 300 };
    },

    async verifyOtp(input) {
      const chatId = await resolveChatId(input);
      const otp = input.otp.trim();
      const challengeToken = input.challengeToken;

      if (otp.length !== 6 || !challengeToken) {
        throw new Error("AUTH_INVALID_OTP_PAYLOAD");
      }

      const isValid = await config.session.verifyOtpChallenge(challengeToken, chatId, otp);
      if (!isValid) throw new Error("AUTH_INVALID_OTP");

      const sessionToken = await config.session.issueSession(chatId);
      return { sessionToken };
    },

    async getSessionChatId(sessionToken: string) {
      const payload = await config.session.verifySession(sessionToken);
      return payload?.chatId ?? null;
    },
  };
};
