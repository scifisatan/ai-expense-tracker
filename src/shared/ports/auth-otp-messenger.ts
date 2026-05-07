export interface AuthOtpMessenger {
  sendOtp(chatId: number, otp: string): Promise<void>;
}
