import type { AppDb } from "@/db/client"

import { and, asc, eq } from "drizzle-orm"
import { categories } from "@/db/schema"

export type CategoryPatch = {
  name?: string
  type?: "Income" | "Expense"
  color?: string | null
}

export const createCategoriesRepo = (db: AppDb) => ({
  listByAccount: (accountId: string) =>
    db.query.categories.findMany({
      where: eq(categories.accountId, accountId),
      orderBy: [asc(categories.type), asc(categories.name)],
    }),

  findById: (accountId: string, id: number) =>
    db.query.categories.findFirst({
      where: and(eq(categories.id, id), eq(categories.accountId, accountId)),
    }),

  create: (accountId: string, input: { name: string; type: "Income" | "Expense"; color?: string | null }) =>
    db
      .insert(categories)
      .values({ accountId, name: input.name, type: input.type, color: input.color ?? null })
      .returning(),

  update: (accountId: string, id: number, patch: CategoryPatch) =>
    db
      .update(categories)
      .set(patch)
      .where(and(eq(categories.id, id), eq(categories.accountId, accountId))),

  remove: (accountId: string, id: number) =>
    db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.accountId, accountId))),
})

export type CategoriesRepo = ReturnType<typeof createCategoriesRepo>
