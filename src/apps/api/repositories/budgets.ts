import type { AppDb } from "@/db/client"

import { and, asc, eq } from "drizzle-orm"
import { budgets, budgetAlerts } from "@/db/schema"

export type BudgetPatch = {
  categoryId?: number | null
  amountMinor?: number
  currency?: string
}

export const createBudgetsRepo = (db: AppDb) => ({
  listByAccount: (accountId: string) =>
    db.query.budgets.findMany({
      where: eq(budgets.accountId, accountId),
      orderBy: [asc(budgets.id)]
    }),

  findById: (accountId: string, id: number) =>
    db.query.budgets.findFirst({
      where: and(eq(budgets.id, id), eq(budgets.accountId, accountId))
    }),

  create: (
    accountId: string,
    input: { categoryId?: number | null; amountMinor: number; currency: string }
  ) =>
    db
      .insert(budgets)
      .values({
        accountId,
        categoryId: input.categoryId ?? null,
        amountMinor: input.amountMinor,
        currency: input.currency
      })
      .returning(),

  update: (accountId: string, id: number, patch: BudgetPatch) =>
    db
      .update(budgets)
      .set(patch)
      .where(and(eq(budgets.id, id), eq(budgets.accountId, accountId))),

  remove: (accountId: string, id: number) =>
    db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.accountId, accountId))),

  // Alert bookkeeping: a row exists once a (budget, period, threshold) has fired.
  hasAlerted: async (budgetId: number, periodKey: string, threshold: number): Promise<boolean> => {
    const row = await db.query.budgetAlerts.findFirst({
      where: and(
        eq(budgetAlerts.budgetId, budgetId),
        eq(budgetAlerts.periodKey, periodKey),
        eq(budgetAlerts.threshold, threshold)
      )
    })
    return !!row
  },

  recordAlert: (budgetId: number, periodKey: string, threshold: number) =>
    db.insert(budgetAlerts).values({ budgetId, periodKey, threshold }).onConflictDoNothing()
})

export type BudgetsRepo = ReturnType<typeof createBudgetsRepo>
