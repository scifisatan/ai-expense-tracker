import type { AppDb } from "@/db/client"

import { and, eq, lt, sql } from "drizzle-orm"
import { dayCloses, fundLedger, morningPushes } from "@/db/schema"

export type NewDayCloseInput = {
  accountId: string
  localDate: string
  cycleId: number
  allowanceMinor: number
  spentMinor: number
  sweptMinor: number
}

export type FundBucket = "want_fund" | "needs_reserve"

export const createPacerRepo = (db: AppDb) => ({
  findDayClose: (accountId: string, localDate: string) =>
    db.query.dayCloses.findFirst({
      where: and(eq(dayCloses.accountId, accountId), eq(dayCloses.localDate, localDate))
    }),

  // spentMinor/sweptMinor already locked in by every day_close before
  // `beforeLocalDate` in this cycle — the running totals allowanceForDay needs.
  sumForCycleBefore: async (
    cycleId: number,
    beforeLocalDate: string
  ): Promise<{ spentMinor: number; sweptMinor: number }> => {
    const result = await db
      .select({
        spentMinor: sql<number>`COALESCE(SUM(${dayCloses.spentMinor}), 0)`,
        sweptMinor: sql<number>`COALESCE(SUM(${dayCloses.sweptMinor}), 0)`
      })
      .from(dayCloses)
      .where(and(eq(dayCloses.cycleId, cycleId), lt(dayCloses.localDate, beforeLocalDate)))
      .get()
    return { spentMinor: result?.spentMinor ?? 0, sweptMinor: result?.sweptMinor ?? 0 }
  },

  // Not awaited here — composed into the day-close cron's db.batch() alongside
  // the fund-ledger insert so both writes land atomically.
  insertDayClose: (input: NewDayCloseInput) =>
    db
      .insert(dayCloses)
      .values({
        accountId: input.accountId,
        localDate: input.localDate,
        cycleId: input.cycleId,
        allowanceMinor: input.allowanceMinor,
        spentMinor: input.spentMinor,
        sweptMinor: input.sweptMinor
      })
      .onConflictDoNothing(),

  balance: async (accountId: string, bucket: FundBucket): Promise<number> => {
    const result = await db
      .select({ balance: sql<number>`COALESCE(SUM(${fundLedger.deltaMinor}), 0)` })
      .from(fundLedger)
      .where(and(eq(fundLedger.accountId, accountId), eq(fundLedger.bucket, bucket)))
      .get()
    return result?.balance ?? 0
  },

  // Also not awaited — same batch as insertDayClose.
  insertSweep: (input: { accountId: string; deltaMinor: number; dayCloseLocalDate: string }) =>
    db.insert(fundLedger).values({
      accountId: input.accountId,
      bucket: "want_fund",
      deltaMinor: input.deltaMinor,
      reason: "sweep",
      dayCloseLocalDate: input.dayCloseLocalDate
    }),

  insertReserveCredit: (input: {
    accountId: string
    deltaMinor: number
    dayCloseLocalDate: string
  }) =>
    db.insert(fundLedger).values({
      accountId: input.accountId,
      bucket: "needs_reserve",
      deltaMinor: input.deltaMinor,
      reason: "reserve_credit",
      dayCloseLocalDate: input.dayCloseLocalDate
    }),

  insertPurchaseDebit: (input: {
    accountId: string
    bucket: FundBucket
    priceMinor: number
    queueItemId: number
  }) =>
    db.insert(fundLedger).values({
      accountId: input.accountId,
      bucket: input.bucket,
      deltaMinor: -input.priceMinor,
      reason: "purchase",
      queueItemId: input.queueItemId
    }),

  findMorningPush: (accountId: string, localDate: string) =>
    db.query.morningPushes.findFirst({
      where: and(eq(morningPushes.accountId, accountId), eq(morningPushes.localDate, localDate))
    }),

  insertMorningPush: (accountId: string, localDate: string) =>
    db.insert(morningPushes).values({ accountId, localDate }).onConflictDoNothing()
})

export type PacerRepo = ReturnType<typeof createPacerRepo>
