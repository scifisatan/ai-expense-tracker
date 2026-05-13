import { eq } from 'drizzle-orm';
import type { AppDb } from '../client';
import { users } from '../schema';
import type { TelegramUserRecord } from './types';

export async function saveTelegramUser(db: AppDb, user: TelegramUserRecord) {
  await db
    .insert(users)
    .values({
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    })
    .onConflictDoUpdate({
      target: users.userId,
      set: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
}

export async function findByUserId(db: AppDb, userId: number) {
  return await db.query.users.findFirst({
    where: eq(users.userId, userId),
  });
}
