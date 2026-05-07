import type { AuthOtpMessenger } from "../ports/auth-otp-messenger";

export const createTelegramOtpMessenger = (botToken: string): AuthOtpMessenger => ({
  async sendOtp(chatId: number, otp: string) {
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 Budget Bot Web Login OTP: ${otp}\n\nThis code expires in 5 minutes.`,
      }),
    });

    const telegramJson = (await telegramRes.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
    } | null;

    if (!telegramRes.ok || !telegramJson?.ok) {
      throw new Error(
        telegramJson?.description ??
          "Could not send OTP to Telegram. Ensure you already started the bot in that chat.",
      );
    }
  },
});
