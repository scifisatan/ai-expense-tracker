
import { AuthIdentifier, VerifyOtpInput } from "@/shared/types/auth";
import type { AuthOtpMessenger } from "../ports/auth-otp-messenger";
import type { AuthSession } from "../ports/auth-session";

export interface AuthModule {
  requestOtp(input: AuthIdentifier): Promise<{ challengeToken: string; expiresInSeconds: number }>;
  verifyOtp(input: VerifyOtpInput): Promise<{ sessionToken: string }>;
}

export interface AuthModuleConfig {
  otpMessenger?: AuthOtpMessenger;
  session: AuthSession;
}

export const createAuthModule = (config: AuthModuleConfig): AuthModule => {
  const resolveChatId = async (input: AuthIdentifier): Promise<number> => {
    if (input.chatId) {
       return input.chatId 
      } else {
        throw new Error("CHAT_ID_MISSING")
      }
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
  };
};
