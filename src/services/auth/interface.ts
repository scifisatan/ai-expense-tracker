export interface SessionPayload {
  chatId: number;
  exp: number;
}

export interface OtpChallengePayload {
  chatId: number;
  nonce: string;
  otpHash: string;
  exp: number;
}

export interface SessionManager {
  issueSession(chatId: number): Promise<string>;
  verifySession(token: string): Promise<SessionPayload | null>;
  issueOtpChallenge(chatId: number): Promise<{ challengeToken: string; otp: string }>;
  verifyOtpChallenge(challengeToken: string, chatId: number, otp: string): Promise<boolean>;
}
