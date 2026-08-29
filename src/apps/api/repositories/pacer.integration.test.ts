// Integration tests for the cycles/pacer/queue repositories, run against a real
// SQLite database (better-sqlite3, in-memory) built from the actual migrations.
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"
import type { AppDb } from "@/db/client"
import { createRepositories } from "@api/repositories"

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../migrations", import.meta.url))

const createTestDb = (): AppDb => {
  const sqlite = new Database(":memory:")
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  for (const file of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
  }
  return drizzle(sqlite, { schema }) as unknown as AppDb
}

let accountSeq = 0

const setup = async () => {
  const db = createTestDb()
  const repos = createRepositories(db)
  accountSeq += 1
  const account = await repos.accounts.upsertByOauth({
    provider: "google",
    subject: `subject-${accountSeq}`,
    email: `user-${accountSeq}@example.com`
  })
  return { db, repos, accountId: account.id }
}

describe("cycles repo", () => {
  it("creates a cycle with allocations and lists it back", async () => {
    const { repos, accountId } = await setup()

    const cycle = await repos.cycles.create(accountId, {
      startAt: "2026-06-01 00:00:00",
      endAt: "2026-07-01 00:00:00",
      grossMinor: 1_800_000,
      currency: "USD",
      sweepPct: 50
    })
    await repos.cycles.addAllocations(cycle.id, [
      { kind: "fixed", label: "Rent", amountMinor: 500_000 },
      { kind: "needs_reserve", label: "Needs reserve", amountMinor: 200_000 }
    ])

    const found = await repos.cycles.findOpenForDate(accountId, "2026-06-15 00:00:00")
    expect(found?.id).toBe(cycle.id)

    const allocations = await repos.cycles.listAllocations(cycle.id)
    expect(allocations).toHaveLength(2)
    expect(allocations.reduce((sum, a) => sum + a.amountMinor, 0)).toBe(700_000)
  })

  it("no longer reports a cycle as open once its end date has passed", async () => {
    const { repos, accountId } = await setup()
    await repos.cycles.create(accountId, {
      startAt: "2026-06-01 00:00:00",
      endAt: "2026-07-01 00:00:00",
      grossMinor: 100_000,
      currency: "USD",
      sweepPct: 50
    })

    const found = await repos.cycles.findOpenForDate(accountId, "2026-07-01 00:00:00")
    expect(found).toBeUndefined()
  })

  it("stops listing an account for cron fan-out once its cycle is closed", async () => {
    const { repos, accountId } = await setup()
    const cycle = await repos.cycles.create(accountId, {
      startAt: "2026-06-01 00:00:00",
      endAt: "2026-07-01 00:00:00",
      grossMinor: 100_000,
      currency: "USD",
      sweepPct: 50
    })

    expect(await repos.cycles.listAccountsWithOpenCycle(null, 100)).toContain(accountId)

    await repos.cycles.close(accountId, cycle.id)
    expect(await repos.cycles.listAccountsWithOpenCycle(null, 100)).not.toContain(accountId)
  })
})

describe("pacer repo (day closes + fund ledger)", () => {
  it("sums prior day-closes for a cycle and is idempotent on duplicate inserts", async () => {
    const { repos, accountId } = await setup()
    const cycle = await repos.cycles.create(accountId, {
      startAt: "2026-06-01 00:00:00",
      endAt: "2026-07-01 00:00:00",
      grossMinor: 1_800_000,
      currency: "USD",
      sweepPct: 100
    })

    // db.batch() is D1-only (the better-sqlite3 driver used here doesn't
    // implement it); awaiting sequentially exercises the same repo methods
    // that production composes into one atomic batch.
    const insertDay = async (localDate: string, spentMinor: number, sweptMinor: number) => {
      await repos.pacer.insertDayClose({
        accountId,
        localDate,
        cycleId: cycle.id,
        allowanceMinor: 60_000,
        spentMinor,
        sweptMinor
      })
      await repos.pacer.insertSweep({ accountId, deltaMinor: sweptMinor, dayCloseLocalDate: localDate })
    }

    await insertDay("2026-06-01", 40_000, 20_000)
    await insertDay("2026-06-02", 60_000, 0)

    const before = await repos.pacer.sumForCycleBefore(cycle.id, "2026-06-03")
    expect(before).toEqual({ spentMinor: 100_000, sweptMinor: 20_000 })
    expect(await repos.pacer.balance(accountId, "want_fund")).toBe(20_000)

    // Re-running the same day's close (as a retried cron tick would) must not
    // double-write the day_closes row — onConflictDoNothing on the PK.
    await repos.pacer.insertDayClose({
      accountId,
      localDate: "2026-06-01",
      cycleId: cycle.id,
      allowanceMinor: 60_000,
      spentMinor: 999_999,
      sweptMinor: 999_999
    })
    const stillBefore = await repos.pacer.sumForCycleBefore(cycle.id, "2026-06-03")
    expect(stillBefore).toEqual({ spentMinor: 100_000, sweptMinor: 20_000 })
  })

  it("debits a purchase from the correct fund bucket", async () => {
    const { repos, accountId } = await setup()
    const item = await repos.queue.create(accountId, {
      kind: "want",
      title: "Headphones",
      priceMinor: 2000,
      currency: "USD",
      rank: 1000,
      coolingUntil: null,
      deadline: null
    })
    await repos.pacer.insertSweep({ accountId, deltaMinor: 5000, dayCloseLocalDate: "2026-06-01" })
    await repos.pacer.insertReserveCredit({
      accountId,
      deltaMinor: 20_000,
      dayCloseLocalDate: "2026-06-01"
    })
    expect(await repos.pacer.balance(accountId, "want_fund")).toBe(5000)
    expect(await repos.pacer.balance(accountId, "needs_reserve")).toBe(20_000)

    await repos.pacer.insertPurchaseDebit({
      accountId,
      bucket: "want_fund",
      priceMinor: 2000,
      queueItemId: item.id
    })
    expect(await repos.pacer.balance(accountId, "want_fund")).toBe(3000)
    expect(await repos.pacer.balance(accountId, "needs_reserve")).toBe(20_000)
  })

  it("guards the morning push the same way as day close", async () => {
    const { repos, accountId } = await setup()
    expect(await repos.pacer.findMorningPush(accountId, "2026-06-01")).toBeUndefined()
    await repos.pacer.insertMorningPush(accountId, "2026-06-01")
    expect(await repos.pacer.findMorningPush(accountId, "2026-06-01")).toBeDefined()
  })
})

describe("queue repo", () => {
  it("computes a midpoint rank between neighbors and lists in rank order", async () => {
    const { repos, accountId } = await setup()
    const a = await repos.queue.create(accountId, {
      kind: "want",
      title: "Headphones",
      priceMinor: 8500,
      currency: "USD",
      rank: 1000,
      coolingUntil: null,
      deadline: null
    })
    const b = await repos.queue.create(accountId, {
      kind: "want",
      title: "Watch",
      priceMinor: 20000,
      currency: "USD",
      rank: 2000,
      coolingUntil: null,
      deadline: null
    })

    const { prevRank, nextRank } = await repos.queue.neighbors(accountId, "want", a.id)
    expect(prevRank).toBe(1000)
    expect(nextRank).toBe(2000)

    const list = await repos.queue.listByAccount(accountId, "want")
    expect(list.map((i) => i.id)).toEqual([a.id, b.id])
  })

  it("renormalizes queued ranks to evenly spaced integers", async () => {
    const { repos, accountId } = await setup()
    const a = await repos.queue.create(accountId, {
      kind: "need",
      title: "Shoes",
      priceMinor: 3000,
      currency: "USD",
      rank: 1.0000001,
      coolingUntil: null,
      deadline: null
    })
    const b = await repos.queue.create(accountId, {
      kind: "need",
      title: "Bag",
      priceMinor: 4000,
      currency: "USD",
      rank: 1.0000002,
      coolingUntil: null,
      deadline: null
    })

    await repos.queue.renormalize(accountId, "need")

    const list = await repos.queue.listByAccount(accountId, "need")
    expect(list.map((i) => i.id)).toEqual([a.id, b.id])
    expect(list.map((i) => i.rank)).toEqual([1000, 2000])
  })

  it("marks an item purchased and excludes it from the queued list", async () => {
    const { repos, accountId } = await setup()
    const item = await repos.queue.create(accountId, {
      kind: "want",
      title: "Headphones",
      priceMinor: 8500,
      currency: "USD",
      rank: 1000,
      coolingUntil: null,
      deadline: null
    })

    await repos.queue.markPurchased(accountId, item.id)
    await repos.pacer.insertPurchaseDebit({
      accountId,
      bucket: "want_fund",
      priceMinor: item.priceMinor,
      queueItemId: item.id
    })

    const list = await repos.queue.listByAccount(accountId, "want")
    expect(list).toHaveLength(0)

    const found = await repos.queue.findById(accountId, item.id)
    expect(found?.status).toBe("purchased")
  })
})
