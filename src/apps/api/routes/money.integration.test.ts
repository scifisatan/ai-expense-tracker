// Integration tests for the money-mutating tRPC procedures, run against a real
// SQLite database (better-sqlite3, in-memory) built from the actual migrations.
// The drizzle better-sqlite3 instance is call-compatible with the D1 one because
// the repositories only use awaited drizzle calls.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"
import { budgetAlerts, transactions } from "@/db/schema"
import type { AppDb } from "@/db/client"
import type { CloudflareBindings } from "@/apps/env"
import type { ApiContext } from "@api/trpc"
import { createRepositories } from "@api/repositories"
import { router } from "@api/router"
import { monthKey } from "@/shared/datetime"

// ledger.ingestText builds its AI service via createAiService; replace it with a
// programmable stub so no network is involved.
const { extractMock } = vi.hoisted(() => ({ extractMock: vi.fn() }))

vi.mock("@/services/ai", () => ({
  createAiService: () => ({ extractTransactions: extractMock }),
}))

// --- helpers -----------------------------------------------------------------

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../migrations", import.meta.url))

// Fresh in-memory DB with the real migrations applied in filename order.
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

// Minimal in-memory KV: only get/put are used (settings botUsername lookup and
// the AI rate limiter in @api/lib/rate-limit).
const createKvStub = (): KVNamespace => {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
  } as unknown as KVNamespace
}

let accountSeq = 0

type SetupOptions = {
  currency?: string
  timezone?: string
  actor?: "web" | "bot"
  aiDailyLimit?: string
}

// Fresh DB + account (with the default category set seeded) + tRPC caller.
// waitUntil promises are collected so tests can `flush()` background side
// effects (budget alerts, balance publishing) before asserting.
const setup = async (options: SetupOptions = {}) => {
  const db = createTestDb()
  const repos = createRepositories(db)

  accountSeq += 1
  const account = await repos.accounts.upsertByOauth({
    provider: "google",
    subject: `subject-${accountSeq}`,
    email: `user-${accountSeq}@example.com`,
  })
  if (options.currency) await repos.accounts.setDefaultCurrency(account.id, options.currency)
  if (options.timezone) await repos.accounts.setTimezone(account.id, options.timezone)

  const pending: Promise<unknown>[] = []
  const env = {
    BOT_TOKEN: undefined, // makes publishBalance and Telegram alerts no-ops
    GROQ_API_KEY: "",
    AI_MODEL: "",
    AI_DAILY_LIMIT: options.aiDailyLimit ?? "1000",
    BOT_INFO: createKvStub(),
  } as CloudflareBindings

  const ctx: ApiContext = {
    db,
    env,
    repos,
    accountId: account.id,
    actor: options.actor ?? "web",
    waitUntil: (promise) => {
      pending.push(promise)
    },
    telegram: null,
  }

  return {
    db,
    repos,
    accountId: account.id,
    caller: router.createCaller(ctx),
    flush: async () => {
      await Promise.all(pending)
    },
  }
}

const transactionRows = (db: AppDb, accountId: string) =>
  db.select().from(transactions).where(eq(transactions.accountId, accountId))

// --- tests ---------------------------------------------------------------------

beforeEach(() => {
  extractMock.mockReset()
})

describe("transactions.create", () => {
  it("converts the decimal amount to minor units in the account currency, ignoring input currency", async () => {
    const { caller } = await setup({ currency: "EUR" })

    const result = await caller.transactions.create({
      amount: 12.5,
      type: "Expense",
      currency: "JPY", // per-transaction currency input must be ignored
      note: "lunch",
    })

    expect(result.ok).toBe(true)
    expect(result.transaction.amountMinor).toBe(1250)
    expect(result.transaction.currency).toBe("EUR")
    expect(result.transaction.source).toBe("web")
  })

  it("returns newBalance = income minus expense across rows", async () => {
    const { caller } = await setup()

    const income = await caller.transactions.create({ amount: 100, type: "Income" })
    expect(income.newBalance).toBe(10000)

    const expense = await caller.transactions.create({ amount: 12.5, type: "Expense" })
    expect(expense.newBalance).toBe(10000 - 1250)
  })
})

describe("transactions.update", () => {
  it("recomputes newBalance when the amount changes", async () => {
    const { caller } = await setup()

    const created = await caller.transactions.create({ amount: 10, type: "Expense" })
    expect(created.newBalance).toBe(-1000)

    const updated = await caller.transactions.update({
      id: created.transaction.id,
      amount: 25,
    })
    expect(updated.newBalance).toBe(-2500)
  })

  it("records a budget alert when the update pushes month-to-date spend past a threshold", async () => {
    const { caller, repos, flush } = await setup()

    const { budget } = await caller.budgets.create({ amount: 100 }) // overall, 10000 minor
    const created = await caller.transactions.create({ amount: 50, type: "Expense" })

    // 50% of budget: below every threshold, nothing recorded yet.
    await flush()
    const period = monthKey("UTC")
    expect(await repos.budgets.hasAlerted(budget.id, period, 80)).toBe(false)

    // 90% of budget after the update: crosses the 80% threshold.
    await caller.transactions.update({ id: created.transaction.id, amount: 90 })
    await flush()
    expect(await repos.budgets.hasAlerted(budget.id, period, 80)).toBe(true)
    expect(await repos.budgets.hasAlerted(budget.id, period, 100)).toBe(false)
  })
})

describe("transactions.delete", () => {
  it("deletes rows and recomputes newBalance", async () => {
    const { caller, db, accountId } = await setup()

    await caller.transactions.create({ amount: 100, type: "Income" })
    const expense = await caller.transactions.create({ amount: 30, type: "Expense" })

    const result = await caller.transactions.delete({ ids: [expense.transaction.id] })
    expect(result.newBalance).toBe(10000)
    expect(await transactionRows(db, accountId)).toHaveLength(1)
  })

  it("treats an empty ids array as a no-op returning the current balance", async () => {
    const { caller, db, accountId } = await setup()

    await caller.transactions.create({ amount: 100, type: "Income" })

    const result = await caller.transactions.delete({ ids: [] })
    expect(result.ok).toBe(true)
    expect(result.newBalance).toBe(10000)
    expect(await transactionRows(db, accountId)).toHaveLength(1)
  })
})

describe("settings.setDefaultCurrency", () => {
  it("succeeds while the account has zero transactions", async () => {
    const { caller, repos, accountId } = await setup()

    await caller.settings.setDefaultCurrency({ currency: "gbp" })

    const account = await repos.accounts.findById(accountId)
    expect(account?.defaultCurrency).toBe("GBP")
  })

  it("throws FORBIDDEN once a transaction exists", async () => {
    const { caller } = await setup()

    await caller.transactions.create({ amount: 1, type: "Expense" })

    await expect(caller.settings.setDefaultCurrency({ currency: "EUR" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })
})

describe("ledger.ingestText", () => {
  it("inserts extracted items with source web for the web actor", async () => {
    const { caller, db, accountId } = await setup()
    extractMock.mockResolvedValue({
      items: [{ amount: 5.25, type: "Expense", note: "coffee" }],
    })

    const result = await caller.ledger.ingestText({ text: "coffee 5.25" })

    expect(result.reason).toBeNull()
    expect(result.insertedIds).toHaveLength(1)
    expect(result.newBalance).toBe(-525)

    const [row] = await transactionRows(db, accountId)
    expect(row.source).toBe("web")
    expect(row.amountMinor).toBe(525)
    expect(row.currency).toBe("USD")
    expect(row.note).toBe("coffee")
  })

  it("inserts with source telegram when the actor is the bot", async () => {
    const { caller, db, accountId } = await setup({ actor: "bot" })
    extractMock.mockResolvedValue({
      items: [{ amount: 3, type: "Expense", note: "tea" }],
    })

    await caller.ledger.ingestText({ text: "tea 3" })

    const [row] = await transactionRows(db, accountId)
    expect(row.source).toBe("telegram")
  })

  it("resolves category hints case-insensitively and never creates categories", async () => {
    const { caller, repos, accountId } = await setup()
    const before = await repos.categories.listByAccount(accountId)
    const food = before.find((c) => c.name === "Food" && c.type === "Expense")
    expect(food).toBeDefined()

    extractMock.mockResolvedValue({
      items: [
        { amount: 10, type: "Expense", note: "groceries", category: "fOoD" },
        { amount: 20, type: "Expense", note: "boat gas", category: "Yacht Fuel" },
      ],
    })

    const result = await caller.ledger.ingestText({ text: "groceries 10, boat gas 20" })

    expect(result.items[0].categoryId).toBe(food!.id)
    expect(result.items[0].categoryName).toBe("Food")
    expect(result.items[1].categoryId).toBeNull()

    const after = await repos.categories.listByAccount(accountId)
    expect(after).toHaveLength(before.length)
  })

  it("passes the account's category names to the AI split into expense and income", async () => {
    const { caller } = await setup()
    extractMock.mockResolvedValue({ items: [] })

    await caller.ledger.ingestText({ text: "nothing here" })

    expect(extractMock).toHaveBeenCalledTimes(1)
    const [text, today, categoryNames] = extractMock.mock.calls[0]
    expect(text).toBe("nothing here")
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect([...categoryNames.expense].sort()).toEqual([
      "Bills",
      "Entertainment",
      "Food",
      "Other",
      "Shopping",
      "Transport",
    ])
    expect([...categoryNames.income].sort()).toEqual(["Other Income", "Salary"])
  })

  it("rate limits after AI_DAILY_LIMIT calls without invoking the AI", async () => {
    const { caller, db, accountId } = await setup({ aiDailyLimit: "1" })
    extractMock.mockResolvedValue({
      items: [{ amount: 1, type: "Expense", note: "first" }],
    })

    const first = await caller.ledger.ingestText({ text: "first 1" })
    expect(first.reason).toBeNull()
    expect(extractMock).toHaveBeenCalledTimes(1)

    const second = await caller.ledger.ingestText({ text: "second 2" })
    expect(second.reason).toBe("RATE_LIMITED")
    expect(second.insertedIds).toEqual([])
    expect(second.newBalance).toBeNull()
    expect(extractMock).toHaveBeenCalledTimes(1) // AI never called for the second request
    expect(await transactionRows(db, accountId)).toHaveLength(1)
  })

  it("returns AI_ERROR and inserts nothing when the AI fails", async () => {
    const { caller, db, accountId } = await setup()
    extractMock.mockRejectedValue(new Error("model exploded"))

    const result = await caller.ledger.ingestText({ text: "coffee 5" })

    expect(result.reason).toBe("AI_ERROR")
    expect(result.insertedIds).toEqual([])
    expect(result.newBalance).toBeNull()
    expect(await transactionRows(db, accountId)).toHaveLength(0)
  })
})

describe("budget alert dedup", () => {
  it("records a threshold alert only once per budget and period", async () => {
    const { caller, db, flush } = await setup()

    const { budget } = await caller.budgets.create({ amount: 100 })

    // Both writes leave month-to-date spend past 80% (85% then 90%).
    await caller.transactions.create({ amount: 85, type: "Expense" })
    await flush()
    await caller.transactions.create({ amount: 5, type: "Expense" })
    await flush()

    const alerts = await db.select().from(budgetAlerts).where(eq(budgetAlerts.budgetId, budget.id))
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ periodKey: monthKey("UTC"), threshold: 80 })
  })
})
