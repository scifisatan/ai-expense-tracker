import { TokenSessionManager } from "../services/auth/token-manager";

export const createUserConfigStore = (db: D1Database) => {
  return {
    async getGroqApiKey(userId: number): Promise<string | null> {
      const row = await db
        .prepare("SELECT groq_api_key FROM user_settings WHERE user_id = ?")
        .bind(userId)
        .first<{ groq_api_key: string | null }>();

      return row?.groq_api_key ?? null;
    },

    async setGroqApiKey(userId: number, apiKey: string) {
      await db
        .prepare(
          `
            INSERT INTO user_settings (user_id, groq_api_key)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              groq_api_key = excluded.groq_api_key,
              updated_at = CURRENT_TIMESTAMP
          `,
        )
        .bind(userId, apiKey)
        .run();
    },

    async removeGroqApiKey(userId: number) {
      await db
        .prepare(
          `
            UPDATE user_settings SET groq_api_key = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
          `,
        )
        .bind(userId)
        .run();
    },

    async generateOtp(chatId: number, secret: string) {
      const manager = new TokenSessionManager(secret);
      const { otp } = await manager.issueOtpChallenge(chatId);
      return otp;
    },
  };
};

export type UserConfigStore = ReturnType<typeof createUserConfigStore>;
