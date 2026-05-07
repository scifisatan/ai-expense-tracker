export type AuthIdentifier = {
  username?: string;
  chatId?: number;
};

export type VerifyOtpInput = AuthIdentifier & {
  otp: string;
  challengeToken: string;
};
