import type { AppDb } from "@/db/client"

import { and, eq, sql } from "drizzle-orm"
import { accounts, categories } from "@/db/schema"
import type { Account } from "@/db/schema"

export type OauthProfile = {
  provider: string
  subject: string
  email: string
  name?: string | null
}

const DEFAULT_CATEGORIES: { name: string; type: "Income" | "Expense" }[] = [
  { name: "Salary", type: "Income" },
  { name: "Other Income", type: "Income" },
  { name: "Food", type: "Expense" },
  { name: "Transport", type: "Expense" },
  { name: "Shopping", type: "Expense" },
  { name: "Bills", type: "Expense" },
  { name: "Entertainment", type: "Expense" },
  { name: "Other", type: "Expense" },
]

export const createAccountsRepo = (db: AppDb) => ({
  findById: (id: string) =>
    db.query.accounts.findFirst({ where: eq(accounts.id, id) }),

  findByOauth: (provider: string, subject: string) =>
    db.query.accounts.findFirst({
      where: and(eq(accounts.oauthProvider, provider), eq(accounts.oauthSubject, subject)),
    }),

  // Find an existing account by OAuth identity or create one (seeding default categories).
  upsertByOauth: async (profile: OauthProfile): Promise<Account> => {
    const existing = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.oauthProvider, profile.provider),
        eq(accounts.oauthSubject, profile.subject),
      ),
    })

    if (existing) return existing

    const id = crypto.randomUUID()

    await db.insert(accounts).values({
      id,
      email: profile.email,
      name: profile.name ?? null,
      oauthProvider: profile.provider,
      oauthSubject: profile.subject,
    })

    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({ accountId: id, name: c.name, type: c.type })),
    )

    const created = await db.query.accounts.findFirst({ where: eq(accounts.id, id) })
    if (!created) throw new Error("ACCOUNT_CREATE_FAILED")
    return created
  },

  setDefaultCurrency: (id: string, currency: string) =>
    db.update(accounts).set({ defaultCurrency: currency }).where(eq(accounts.id, id)),

  setTimezone: (id: string, timezone: string) =>
    db.update(accounts).set({ timezone }).where(eq(accounts.id, id)),

  // Invalidate every outstanding session token for the account.
  bumpTokenVersion: (id: string) =>
    db
      .update(accounts)
      .set({ tokenVersion: sql`${accounts.tokenVersion} + 1` })
      .where(eq(accounts.id, id)),
})

export type AccountsRepo = ReturnType<typeof createAccountsRepo>
