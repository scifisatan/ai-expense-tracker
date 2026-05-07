import type { AuthIdentityRepo } from "../../ports/auth-identity-repo";

export const createD1AuthIdentityRepo = (db: D1Database): AuthIdentityRepo => ({
  async findChatIdByUsername(username: string) {
    const user = await db
      .prepare("SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)")
      .bind(username)
      .first<{ user_id: number }>();

    return user?.user_id ?? null;
  },
});
