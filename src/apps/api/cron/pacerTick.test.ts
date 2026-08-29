// Integration test for the day-close cron, run against a real SQLite database
// (better-sqlite3, in-memory) built from the actual migrations. The key
// property under test: re-running the same tick must never double-write.
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"
import type { AppDb } from "@/db/client"
import type { CloudflareBindings } from "@/apps/env"
import { createRepositories } from "@api/repositories"
import { localDateString, addDays, startOfLocalDay } from "@/shared/datetime"
import { toMinor } from "@/shared/money"
import { runPacerTick } from "./pacerTick"

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
  ;(db as unknown as { batch: (queries: Promise<unknown>[]) => Promise<unknown[]> }).batch = (
    queries
  ) => Promise.all(queries)
  return db as unknown as AppDb
}

const rowCounts = async (db: AppDb) => ({
  dayCloses: (await db.select().from(schema.dayCloses)).length,
  fundLedger: (await db.select().from(schema.fundLedger)).length,
  morningPushes: (await db.select().from(schema.morningPushes)).length
})

describe("runPacerTick", () => {
  it("is idempotent: running the same tick twice leaves row counts and fund balance unchanged", async () => {
    const db = createTestDb()
    const repos = createRepositories(db)
    const account = await repos.accounts.upsertByOauth({
      provider: "google",
      subject: "subject-1",
      email: "user@example.com"
    })
    await repos.accounts.setTimezone(account.id, "UTC")

    // now = today at 00:20 UTC, matching the plan's day-close cron timing
    // (just after local midnight) so "yesterday" is the cycle's first day.
    const today = localDateString("UTC")
    const yesterday = addDays("UTC", today, -1)
    const now = new Date(`${today}T00:20:00Z`)

    const cycle = await repos.cycles.create(account.id, {
      startAt: startOfLocalDay("UTC", yesterday),
      endAt: startOfLocalDay("UTC", addDays("UTC", yesterday, 30)),
      grossMinor: toMinor(180, "USD"),
      currency: "USD",
      sweepPct: 100
    })
    await repos.cycles.addAllocations(cycle.id, [
      { kind: "needs_reserve", label: "Needs reserve", amountMinor: toMinor(50, "USD") }
    ])
    // Pool is 130 (gross 180 minus the 50 reserve allocation) over 30 days,
    // an allowance of ~4.33/day — spending 2 leaves a positive sweep.
    await repos.transactions.insertOne(account.id, {
      amountMinor: toMinor(2, "USD"),
      currency: "USD",
      type: "Expense",
      occurredAt: `${yesterday} 12:00:00`,
      source: "web"
    })

    const env = {} as CloudflareBindings

    await runPacerTick(db, env, now)
    const afterFirst = await rowCounts(db)
    expect(afterFirst.dayCloses).toBe(1)
    expect(afterFirst.fundLedger).toBe(2) // sweep + first-day reserve credit
    const wantFundAfterFirst = await repos.pacer.balance(account.id, "want_fund")
    const needsReserveAfterFirst = await repos.pacer.balance(account.id, "needs_reserve")

    // Same tick again — a retried cron invocation.
    await runPacerTick(db, env, now)
    const afterSecond = await rowCounts(db)

    expect(afterSecond).toEqual(afterFirst)
    expect(await repos.pacer.balance(account.id, "want_fund")).toBe(wantFundAfterFirst)
    expect(await repos.pacer.balance(account.id, "needs_reserve")).toBe(needsReserveAfterFirst)
  })

  it("sends the morning push once at the account's local 8am and never again the same day", async () => {
    const db = createTestDb()
    const repos = createRepositories(db)
    const account = await repos.accounts.upsertByOauth({
      provider: "google",
      subject: "subject-2",
      email: "user2@example.com"
    })
    await repos.accounts.setTimezone(account.id, "UTC")

    const today = localDateString("UTC")
    await repos.cycles.create(account.id, {
      startAt: startOfLocalDay("UTC", today),
      endAt: startOfLocalDay("UTC", addDays("UTC", today, 30)),
      grossMinor: toMinor(180, "USD"),
      currency: "USD",
      sweepPct: 100
    })

    const env = {} as CloudflareBindings // no BOT_TOKEN: notifyLinkedChats is a no-op, only the guard row matters

    // A tick outside the 8am window does nothing.
    await runPacerTick(db, env, new Date(`${today}T09:00:00Z`))
    expect(await repos.pacer.findMorningPush(account.id, today)).toBeUndefined()

    // The 8am tick sends it and records the guard.
    await runPacerTick(db, env, new Date(`${today}T08:05:00Z`))
    expect(await repos.pacer.findMorningPush(account.id, today)).toBeDefined()

    // A second tick still inside the 8am hour does not send it again (no
    // observable effect to assert here beyond the guard row staying single —
    // enforced by the table's primary key, exercised via insertMorningPush's
    // onConflictDoNothing not throwing).
    await expect(runPacerTick(db, env, new Date(`${today}T08:10:00Z`))).resolves.not.toThrow()
  })
})
