// Integration tests for cyclesRouter/queueRouter, run against a real SQLite
// database (better-sqlite3, in-memory) built from the actual migrations.
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"
import type { AppDb } from "@/db/client"
import type { CloudflareBindings } from "@/apps/env"
import type { ApiContext } from "@api/trpc"
import { createRepositories } from "@api/repositories"
import { router } from "@api/router"
import { localDateString, addDays } from "@/shared/datetime"

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../migrations", import.meta.url))

const createTestDb = (): AppDb => {
  const sqlite = new Database(":memory:")
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  for (const file of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
  }
  const db = drizzle(sqlite, { schema })
  // D1's db.batch() has no equivalent on the better-sqlite3 driver used here.
  // Each statement is already an independently awaitable builder, so running
  // them in order reproduces the same effect for test purposes.
  ;(db as unknown as { batch: (queries: Promise<unknown>[]) => Promise<unknown[]> }).batch = (
    queries
  ) => Promise.all(queries)
  return db as unknown as AppDb
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
  await repos.accounts.setTimezone(account.id, "UTC")

  const env = {} as CloudflareBindings
  const ctx: ApiContext = {
    db,
    env,
    repos,
    accountId: account.id,
    actor: "web",
    waitUntil: () => {},
    telegram: null
  }

  return { db, repos, accountId: account.id, caller: router.createCaller(ctx) }
}

describe("cycles.create + cycles.current", () => {
  it("computes the pool and splits it evenly across the cycle on day one", async () => {
    const { caller } = await setup()
    const today = localDateString("UTC")
    const endDate = addDays("UTC", today, 29) // 30-day cycle, inclusive

    await caller.cycles.create({
      startDate: today,
      endDate,
      gross: 180, // 18000 minor units, matching the plan's worked example
      sweepPct: 100,
      allocations: []
    })

    const result = await caller.cycles.current()
    if (!result.active) throw new Error("expected an active cycle")

    expect(result.poolMinor).toBe(18000)
    expect(result.daysRemainingInclusive).toBe(30)
    expect(result.allowanceMinor).toBe(600)
  })

  it("amortizes prior days' overspend into today's allowance instead of penalizing a single day", async () => {
    const { caller, repos, accountId } = await setup()
    const today = localDateString("UTC")
    const startDate = addDays("UTC", today, -3) // today is the cycle's 4th day
    const endDate = addDays("UTC", startDate, 29)

    const created = await caller.cycles.create({
      startDate,
      endDate,
      gross: 180,
      sweepPct: 100,
      allocations: []
    })
    const cycleId = created.cycle.id

    const day1 = addDays("UTC", today, -3)
    const day2 = addDays("UTC", today, -2)
    const day3 = addDays("UTC", today, -1)

    await repos.pacer.insertDayClose({
      accountId,
      localDate: day1,
      cycleId,
      allowanceMinor: 600,
      spentMinor: 400,
      sweptMinor: 200
    })
    await repos.pacer.insertSweep({ accountId, deltaMinor: 200, dayCloseLocalDate: day1 })
    await repos.pacer.insertDayClose({
      accountId,
      localDate: day2,
      cycleId,
      allowanceMinor: 600,
      spentMinor: 600,
      sweptMinor: 0
    })
    await repos.pacer.insertDayClose({
      accountId,
      localDate: day3,
      cycleId,
      allowanceMinor: 600,
      spentMinor: 1500,
      sweptMinor: 0
    })

    const result = await caller.cycles.current()
    if (!result.active) throw new Error("expected an active cycle")

    // Worked example from the plan: day 3 overspends by 900; day 4 has 27
    // days left and an allowance of 566, not a wiped-out day.
    expect(result.daysRemainingInclusive).toBe(27)
    expect(result.allowanceMinor).toBe(566)
  })
})

describe("queue.purchase", () => {
  it("rejects a purchase while a want is still cooling off", async () => {
    const { caller } = await setup()
    const created = await caller.queue.create({
      kind: "want",
      title: "Headphones",
      price: 85,
      coolingDays: 3
    })

    await expect(caller.queue.purchase({ id: created.item.id })).rejects.toThrow("COOLING")
  })

  it("rejects a purchase when the fund balance is insufficient", async () => {
    const { caller } = await setup()
    const created = await caller.queue.create({
      kind: "want",
      title: "Headphones",
      price: 85,
      coolingDays: 0
    })

    await expect(caller.queue.purchase({ id: created.item.id })).rejects.toThrow("UNDERFUNDED")
  })

  it("succeeds once the want fund covers the price, debiting the ledger and removing it from the queue", async () => {
    const { caller, repos, accountId } = await setup()
    const created = await caller.queue.create({
      kind: "want",
      title: "Headphones",
      price: 85,
      coolingDays: 0
    })
    await repos.pacer.insertSweep({
      accountId,
      deltaMinor: 8500,
      dayCloseLocalDate: localDateString("UTC")
    })

    const result = await caller.queue.purchase({ id: created.item.id })
    expect(result.ok).toBe(true)
    expect(await repos.pacer.balance(accountId, "want_fund")).toBe(0)

    const list = await caller.queue.list({ kind: "want" })
    expect(list.items).toHaveLength(0)
  })
})

describe("queue.reorder", () => {
  it("computes a midpoint rank and reflects the new order in list", async () => {
    const { caller } = await setup()
    const a = await caller.queue.create({ kind: "need", title: "Shoes", price: 30 })
    const b = await caller.queue.create({ kind: "need", title: "Bag", price: 40 })
    const c = await caller.queue.create({ kind: "need", title: "Coat", price: 50 })

    // Initial order is creation order: a, b, c. Move c to sit right after a.
    await caller.queue.reorder({ id: c.item.id, afterId: a.item.id })

    const list = await caller.queue.list({ kind: "need" })
    expect(list.items.map((i) => i.id)).toEqual([a.item.id, c.item.id, b.item.id])
    expect(list.items[0]?.cumulativePriceMinor).toBe(3000)
    expect(list.items[1]?.cumulativePriceMinor).toBe(8000) // 3000 + 5000
    expect(list.items[2]?.cumulativePriceMinor).toBe(12000) // 8000 + 4000
  })
})

describe("cycles.lastCompleted and cycles.review", () => {
  it("allows reviewing a completed cycle and retrieving allocations for rollover", async () => {
    const { caller } = await setup()
    const today = localDateString("UTC")
    const startDate = addDays("UTC", today, -10)
    const endDate = addDays("UTC", today, -1)

    const created = await caller.cycles.create({
      startDate,
      endDate,
      gross: 500,
      sweepPct: 50,
      allocations: [{ kind: "fixed", label: "Rent", amount: 200 }]
    })

    // Log an expense during cycle
    await caller.transactions.create({
      amount: 50,
      type: "Expense",
      occurredAt: `${startDate}T12:00:00.000Z`
    })

    // Close the cycle
    await caller.cycles.close({ id: created.cycle.id })

    const last = await caller.cycles.lastCompleted()
    expect(last).not.toBeNull()
    expect(last?.cycle.id).toBe(created.cycle.id)
    expect(last?.allocations).toHaveLength(1)
    expect(last?.allocations[0]?.label).toBe("Rent")

    const review = await caller.cycles.review({ id: created.cycle.id })
    expect(review).not.toBeNull()
    expect(review?.poolMinor).toBe(30000)
    expect(review?.totalSpentMinor).toBe(5000)
  })
})
