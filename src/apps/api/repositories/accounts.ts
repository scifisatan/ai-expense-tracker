import type { AppDb } from "@/db/client"

import { and, eq, inArray, sql } from "drizzle-orm"
import {
  accountSettings,
  accounts,
  budgetAlerts,
  budgets,
  categories,
  telegramLinks,
  transactions,
} from "@/db/schema"
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

  // First-run onboarding: set currency + timezone and mark onboarding complete.
  completeOnboarding: (id: string, input: { currency: string; timezone: string }) =>
    db
      .update(accounts)
      .set({
        defaultCurrency: input.currency,
        timezone: input.timezone,
        onboardedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(accounts.id, id)),

  // Invalidate every outstanding session token for the account.
  bumpTokenVersion: (id: string) =>
    db
      .update(accounts)
      .set({ tokenVersion: sql`${accounts.tokenVersion} + 1` })
      .where(eq(accounts.id, id)),

  // Permanently delete the account and every row that belongs to it. Deletes run
  // child-before-parent so the foreign-key references are always satisfied, and
  // are batched so the whole erasure is atomic (all-or-nothing).
  deleteAccount: (id: string) => {
    const accountBudgetIds = db
      .select({ id: budgets.id })
      .from(budgets)
      .where(eq(budgets.accountId, id))

    return db.batch([
      db.delete(budgetAlerts).where(inArray(budgetAlerts.budgetId, accountBudgetIds)),
      db.delete(budgets).where(eq(budgets.accountId, id)),
      db.delete(transactions).where(eq(transactions.accountId, id)),
      db.delete(categories).where(eq(categories.accountId, id)),
      db.delete(telegramLinks).where(eq(telegramLinks.accountId, id)),
      db.delete(accountSettings).where(eq(accountSettings.accountId, id)),
      db.delete(accounts).where(eq(accounts.id, id)),
    ])
  },
})

export type AccountsRepo = ReturnType<typeof createAccountsRepo>
