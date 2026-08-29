import type { AppDb } from "@/db/client"
import { and, asc, desc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import { cycles, allocations } from "@/db/schema"
import type { AllocationKind } from "@/db/schema"

export type NewCycleInput = {
  startAt: string
  endAt: string
  grossMinor: number
  currency: string
  sweepPct: number
}

export type NewAllocationInput = {
  kind: AllocationKind
  label: string
  amountMinor: number
}

export const createCyclesRepo = (db: AppDb) => ({
  // The cycle covering `dbTs`, if any: not manually closed, and dbTs falls in
  // [startAt, endAt). A cycle whose endAt has already passed stops being
  // "open" even if nobody explicitly closed it.
  findOpenForDate: (accountId: string, dbTs: string) =>
    db.query.cycles.findFirst({
      where: and(
        eq(cycles.accountId, accountId),
        isNull(cycles.closedAt),
        lte(cycles.startAt, dbTs),
        gt(cycles.endAt, dbTs)
      )
    }),

  findLastCompleted: (accountId: string, dbTs: string) =>
    db.query.cycles.findFirst({
      where: and(
        eq(cycles.accountId, accountId),
        or(isNotNull(cycles.closedAt), lte(cycles.endAt, dbTs))
      ),
      orderBy: [desc(cycles.endAt)]
    }),

  findById: (accountId: string, id: number) =>
    db.query.cycles.findFirst({
      where: and(eq(cycles.id, id), eq(cycles.accountId, accountId))
    }),

  listByAccount: (accountId: string) =>
    db.query.cycles.findMany({
      where: eq(cycles.accountId, accountId),
      orderBy: [desc(cycles.startAt)]
    }),

  create: async (accountId: string, input: NewCycleInput) => {
    const [created] = await db
      .insert(cycles)
      .values({
        accountId,
        startAt: input.startAt,
        endAt: input.endAt,
        grossMinor: input.grossMinor,
        currency: input.currency,
        sweepPct: input.sweepPct
      })
      .returning()
    if (!created) throw new Error("CYCLE_CREATE_FAILED")
    return created
  },

  addAllocations: (cycleId: number, items: NewAllocationInput[]) => {
    if (items.length === 0) return Promise.resolve([])
    return db
      .insert(allocations)
      .values(
        items.map((item) => ({
          cycleId,
          kind: item.kind,
          label: item.label,
          amountMinor: item.amountMinor
        }))
      )
      .returning()
  },

  listAllocations: (cycleId: number) =>
    db.query.allocations.findMany({
      where: eq(allocations.cycleId, cycleId),
      orderBy: [asc(allocations.id)]
    }),

  update: (accountId: string, id: number, patch: { grossMinor?: number; sweepPct?: number }) =>
    db
      .update(cycles)
      .set(patch)
      .where(and(eq(cycles.id, id), eq(cycles.accountId, accountId))),

  replaceAllocations: async (cycleId: number, items: NewAllocationInput[]) => {
    await db.delete(allocations).where(eq(allocations.cycleId, cycleId))
    if (items.length === 0) return []
    return db
      .insert(allocations)
      .values(
        items.map((item) => ({
          cycleId,
          kind: item.kind,
          label: item.label,
          amountMinor: item.amountMinor
        }))
      )
      .returning()
  },

  close: (accountId: string, id: number) =>
    db
      .update(cycles)
      .set({ closedAt: new Date().toISOString() })
      .where(and(eq(cycles.id, id), eq(cycles.accountId, accountId))),

  getAccumulatedSavings: async (accountId: string): Promise<number> => {
    const result = await db
      .select({ totalMinor: sql<number>`COALESCE(SUM(${allocations.amountMinor}), 0)` })
      .from(allocations)
      .innerJoin(cycles, eq(allocations.cycleId, cycles.id))
      .where(and(eq(cycles.accountId, accountId), eq(allocations.kind, "savings")))
      .get()
    return result?.totalMinor ?? 0
  },

  // Distinct accountIds with a still-open cycle, keyset-paginated for cron
  // fan-out. cursor is the last accountId seen.
  listAccountsWithOpenCycle: async (cursor: string | null, limit: number): Promise<string[]> => {
    const rows = await db
      .selectDistinct({ accountId: cycles.accountId })
      .from(cycles)
      .where(
        and(isNull(cycles.closedAt), cursor ? gt(cycles.accountId, cursor) : undefined)
      )
      .orderBy(asc(cycles.accountId))
      .limit(limit)
    return rows.map((r) => r.accountId)
  }
})

export type CyclesRepo = ReturnType<typeof createCyclesRepo>
