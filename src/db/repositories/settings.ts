import { eq } from 'drizzle-orm';
import type { AppDb } from '../client';
import { userSettings } from '../schema';

export async function getGroqApiKey(db: AppDb, userId: number) {
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  return settings?.groqApiKey ?? null;
}

export async function setGroqApiKey(db: AppDb, userId: number, apiKey: string) {
  await db
    .insert(userSettings)
    .values({
      userId,
      groqApiKey: apiKey,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        groqApiKey: apiKey,
      },
    });
}

export async function removeGroqApiKey(db: AppDb, userId: number) {
  await db
    .update(userSettings)
    .set({ groqApiKey: null })
    .where(eq(userSettings.userId, userId));
}
