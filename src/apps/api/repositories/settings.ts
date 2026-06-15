import type { AppDb } from "@/db/client"

import { eq } from "drizzle-orm"
import { accountSettings } from "@/db/schema"

export const createSettingsRepo = (db: AppDb) => ({
  getByAccountId: (accountId: string) =>
    db.query.accountSettings.findFirst({
      where: eq(accountSettings.accountId, accountId),
    }),

  getGroqApiKey: async (accountId: string): Promise<string | null> => {
    const settings = await db.query.accountSettings.findFirst({
      where: eq(accountSettings.accountId, accountId),
    })

    return settings?.groqApiKey ?? null
  },

  setGroqApiKey: (accountId: string, key: string | null) =>
    db
      .insert(accountSettings)
      .values({ accountId, groqApiKey: key })
      .onConflictDoUpdate({
        target: accountSettings.accountId,
        set: { groqApiKey: key, updatedAt: new Date().toISOString() },
      }),
})

export type SettingsRepo = ReturnType<typeof createSettingsRepo>
