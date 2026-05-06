export const createUserStore = (db: D1Database) => {
  return {
    async ensureUser(user: { id: number; username?: string; first_name?: string; last_name?: string }) {
      await db
        .prepare(
          `
            INSERT INTO users (user_id, username, first_name, last_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              username = excluded.username,
              first_name = excluded.first_name,
              last_name = excluded.last_name
          `
        )
        .bind(user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null)
        .run();
    },

    async getUser(userId: number) {
      return db
        .prepare('SELECT user_id, username, first_name, last_name FROM users WHERE user_id = ?')
        .bind(userId)
        .first<{ user_id: number; username: string | null; first_name: string | null; last_name: string | null }>();
    }
  };
};
